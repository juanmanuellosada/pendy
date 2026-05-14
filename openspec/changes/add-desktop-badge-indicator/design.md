## Context

Pendy es una PWA hecha con Vite + React. El indicador de pendientes para hoy se sincroniza vía `navigator.setAppBadge` desde `src/hooks/useAppBadge.ts` con un fallback al Service Worker (`public/sw.js`) para iOS. En KDE Plasma el indicador no aparece porque Plasma no implementa la Badging API. El usuario principal corre CachyOS + KDE Plasma 6 y necesita ver el badge.

El proyecto contempla Tauri v2 en su Fase 4 (`CLAUDE.md`), pero `src-tauri/` aún no existe. Para resolver el problema sin esperar a la fase multiplataforma completa, este cambio introduce el subset mínimo de Tauri necesario para emitir un badge nativo, dejando intacto el comportamiento PWA actual.

Restricciones relevantes:

- El bundle PWA NO debe crecer ni cargar código relacionado a Tauri.
- La detección de entorno debe ser barata, síncrona y libre de side effects (se evalúa en cada render del hook).
- KDE Plasma 5.6+ y GNOME-con-extensión-Unity consumen `com.canonical.Unity.LauncherEntry`. KDE 6 sigue soportándolo.
- El usuario está en Arch/CachyOS; el toolchain Rust y las deps de sistema (`webkit2gtk-4.1`, `libsoup`) están disponibles por package manager.

## Goals / Non-Goals

**Goals:**

- Badge visible en KDE Plasma cuando la app corre dentro de Tauri.
- Branching en `useAppBadge` que no afecte la ruta PWA (regresión cero).
- Bootstrap de `src-tauri/` reutilizable para futuros cambios (tray, updater, push) sin re-hacer el setup.
- Stubs por plataforma (macOS / Windows) que dejen el camino abierto sin profundizar implementación ahora.

**Non-Goals:**

- System tray icon, menús nativos, auto-updater, push notifications, deep links → futuros cambios.
- Sync offline / IndexedDB / colas de mutaciones → futuros cambios (Fase 4 del roadmap).
- CI pipeline para builds Tauri en Linux/macOS/Windows → fuera de scope.
- Pulir la implementación macOS/Windows del badge: con stubs minimal funcionales basta. El foco es Linux/KDE.
- Migrar el Service Worker existente: se preserva tal cual como fallback PWA.

## Decisions

### D1. Branching en `useAppBadge` con dynamic import

El hook detecta entorno y bifurca:

```ts
useEffect(() => {
  if (todayCount === undefined) return
  if (isTauri()) {
    void (async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('set_app_badge', { count: todayCount })
      } catch (e) {
        console.warn('[badge] tauri invoke failed', e)
      }
    })()
    return
  }
  // PWA path (unchanged):
  if ('setAppBadge' in navigator) {
    if (todayCount > 0) navigator.setAppBadge(todayCount)
    else navigator.clearAppBadge()
  }
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'SET_BADGE', count: todayCount })
  }
}, [todayCount])
```

**Por qué dynamic import**: garantiza que el módulo `@tauri-apps/api` no se inluya en el chunk PWA. Vite tree-shakea el import solo dentro de la rama gateada.

**Alternativa descartada**: importar estático y confiar en tree-shaking. Riesgo de que el bundler conserve referencias al módulo si la condición no es estáticamente decidible.

**Alternativa descartada**: fallback a Badging API cuando el invoke Tauri falla. Se rechaza para evitar inconsistencia entre runs (a veces badge nativo, a veces no) y porque en Tauri no tiene sentido — si `set_app_badge` falla, mostrar via Badging tampoco va a funcionar en Plasma.

### D2. Helper `isTauri()` chequea `window.__TAURI_INTERNALS__`

```ts
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}
```

Tauri 2.x inyecta `__TAURI_INTERNALS__`. Para compat retro con builds custom o tauri 1.x se podría además chequear `__TAURI__`, pero acotamos a 2.x ya que es el target oficial.

**Alternativa descartada**: `import.meta.env.TAURI`. Solo funciona si Tauri inyectó la variable durante el build de Vite — frágil cuando el dev server corre antes que Tauri se conecte.

### D3. Linux: D-Bus Unity Launcher Entry

Implementación con la crate `zbus` (async, mantenida, sin glue C). El comando emite la señal `Update` sobre `com.canonical.Unity.LauncherEntry`:

```rust
let conn = zbus::Connection::session().await?;
conn.emit_signal(
    None::<&str>,
    "/com/pendy/AppBadge",
    "com.canonical.Unity.LauncherEntry",
    "Update",
    &(
        format!("application://{}.desktop", DESKTOP_ENTRY),
        HashMap::from([
            ("count", Value::I64(count as i64)),
            ("count-visible", Value::Bool(count > 0)),
        ]),
    ),
).await?;
```

`DESKTOP_ENTRY` se hardcodea como constante derivada de `app.identifier` y debe coincidir con el `.desktop` que produce `tauri build` (sección `bundle.linux`).

**Por qué Unity Launcher en KDE**: Plasma 5.6+ implementó soporte para esta señal en su Task Manager (configurable; por defecto activa en Plasma 6). Es el camino más compatible para Linux porque también funciona en GNOME-Ubuntu, Cinnamon, Pantheon y Budgie.

**Alternativa considerada**: `org.kde.StatusNotifierItem`. Esto crearía un ícono separado en la system tray, no un badge sobre el ícono de la ventana — confunde más al usuario y duplica iconografía. Lo dejamos para una eventual Tarea de "Tray icon" en otro change.

**Alternativa descartada**: `notify-send` con persistencia. No es un badge, es una notificación. Categoría incorrecta de UX.

### D4. macOS: `NSApp.dockTile.badgeLabel` con `objc2`

```rust
use objc2::{class, msg_send};
use objc2_foundation::NSString;

let app: *mut Object = unsafe { msg_send![class!(NSApplication), sharedApplication] };
let dock_tile: *mut Object = unsafe { msg_send![app, dockTile] };
let label = if count > 0 { NSString::from_str(&count.to_string()) } else { NSString::from_str("") };
let _: () = unsafe { msg_send![dock_tile, setBadgeLabel: &*label] };
```

Sin dependencia de plugins externos. Usa `objc2` que es la suite Rust-Objective-C moderna y mantenida.

### D5. Windows: `SetOverlayIcon` con renderizado de número

Renderizar un PNG 16x16 con el número (o "9+" para counts grandes) usando la crate `tiny-skia` o `image` + `ab_glyph`. Llamar `ITaskbarList3::SetOverlayIcon` con el HICON convertido.

Si el render se vuelve complejo, alternativa de fallback: 10 íconos pre-renderizados (1-9 y "9+") embebidos como recursos.

Esta es la implementación de menor prioridad porque el usuario primario está en Linux. Se deja un stub funcional ("genérico: hay pendientes/no hay") en el primer release y se itera después.

### D6. Estructura del módulo `badge` en Rust

```
src-tauri/src/
├── main.rs            # entrypoint, llama lib::run()
├── lib.rs             # tauri::Builder, registra el comando set_app_badge
└── badge/
    ├── mod.rs         # pub fn set(count: u32) -> Result<(), BadgeError>
    ├── linux.rs       # cfg(target_os = "linux")
    ├── macos.rs       # cfg(target_os = "macos")
    ├── windows.rs     # cfg(target_os = "windows")
    └── stub.rs        # fallback cfg(not(any(linux, macos, windows)))
```

`mod.rs` re-exporta la impl por OS con `#[cfg]`. El comando `#[tauri::command]` vive en `lib.rs` y delega a `badge::set(count)`.

### D7. Identidad de aplicación

- `tauri.conf.json > identifier = "com.pendy.app"`
- `bundle.linux.deb.desktopTemplate` (y equivalente AppImage) genera `com.pendy.app.desktop` con `StartupWMClass=com.pendy.app`.
- El Rust hardcodea `DESKTOP_ENTRY = "com.pendy.app"`.

Esto cierra el loop para que KDE asocie correctamente la señal D-Bus a la ventana.

### D8. Coexistencia con futuras instancias del wrapper

Hoy el comando es stateless (cada invocación abre y cierra la conexión D-Bus). Si más adelante agregamos otros comandos D-Bus, conviene cachear `zbus::Connection` en `AppState`. No lo hacemos en este cambio para minimizar superficie.

### D9. Frecuencia de invocación

`useAppBadge` se dispara en cada cambio de `todayCount` (vía dependencias del effect). En la práctica, eso significa que el comando se llama:

- Al montar el componente.
- Cada vez que cambia el conjunto de tareas/hábitos pendientes.

No agregamos throttling: la frecuencia es baja (segundos entre cambios) y la operación D-Bus es asíncrona y barata. Si se observa ruido en logs, se ajusta más tarde.

## Risks / Trade-offs

- **[Riesgo] El usuario puede tener deshabilitada la opción "Indicators" en Plasma Task Manager.** → Mitigación: documentar en el README cómo activarla (botón derecho sobre el panel → Show indicators / Show progress and badges).
- **[Riesgo] La crate `zbus` añade overhead de compilación inicial (~30s extra).** → Mitigación: aceptable, es one-time. Si se vuelve molesto, considerar `dbus-rs` sync.
- **[Riesgo] Si el bundler de Tauri cambia el nombre del `.desktop` (p.ej. distintos paths entre AppImage y .deb), la señal D-Bus podría apuntar a un `desktop-entry` incorrecto.** → Mitigación: el código toma el nombre desde `app.identifier`, y los templates de bundle se configuran explícitamente. Test manual en cada plataforma al integrar.
- **[Riesgo] `@tauri-apps/api` añadido como dep podría incluirse en el bundle PWA si el dynamic import no se gatea correctamente.** → Mitigación: test que inspeccione el output de `pnpm build` y grep'ee por `__TAURI_INVOKE__`. Marcar como `optionalDependencies` en package.json para reforzar.
- **[Riesgo] El Service Worker actual también llama `setAppBadge`. En Tauri ese SW también corre.** → Mitigación: el SW solo actúa si recibe `postMessage SET_BADGE`. En la rama Tauri NO mandamos ese mensaje, así que el SW queda inerte. Confirmar con un test.
- **[Trade-off] No abordamos macOS y Windows con la misma profundidad que Linux.** → Aceptado: el objetivo del cambio es destrabar KDE. Los stubs dejan el slot listo para iteración.
- **[Trade-off] No agregamos CI para Tauri builds.** → Aceptado: agregaría scope y secrets de firma. Va en un cambio aparte.

## Migration Plan

No hay migración de datos ni breaking changes. El cambio es aditivo. Plan de despliegue:

1. Merge del cambio. El bundle PWA queda idéntico al actual (verificable por diff de chunks).
2. Usuarios PWA: ningún impacto, siguen viendo el badge donde lo veían (todo OS donde la Badging API funciona).
3. Usuarios que quieran probar la app nativa: clonar repo, `pnpm install`, `pnpm tauri:dev`. No hay binarios distribuidos en este cambio.
4. Rollback: revertir el commit. El frontend vuelve al estado actual; `src-tauri/` simplemente queda huérfano si alguien lo conservó localmente.

## Open Questions

- **¿Bundler default para Linux?** `.deb`, `.AppImage`, ambos. AppImage es más conveniente para Arch/CachyOS porque no requiere apt; .deb es estándar para usuarios Ubuntu/Debian. Decisión: arrancar con AppImage en este cambio; .deb queda para cuando montemos releases.
- **¿Versión mínima de Plasma a soportar?** Plasma 5.6+ implementa Unity Launcher Entry. Sin compromiso explícito; se documenta como "Plasma 5.6 o superior".
- **¿Validar count máximo?** Plasma muestra el número tal cual hasta 99 (más allá puede recortar o no según versión). Hoy no clampeamos. Si se detecta clipping feo, agregar en un cambio posterior.
