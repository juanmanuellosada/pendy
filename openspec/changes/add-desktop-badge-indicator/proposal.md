## Why

El indicador numérico de tareas/hábitos pendientes para hoy no se muestra en KDE Plasma (CachyOS y otros). El código actual depende exclusivamente de la Badging API del navegador (`navigator.setAppBadge`), un estándar PWA que Plasma no expone al Task Manager. Sin un canal nativo, los usuarios de KDE — el entorno principal del propio mantenedor — pierden la única señal visible de pendientes cuando la app no está enfocada.

El proyecto ya tiene a Tauri v2 planificado en la Fase 4 del roadmap (`CLAUDE.md`), pero todavía no está scaffoldeado. Necesitamos abrir el camino con un setup mínimo enfocado en resolver este problema concreto, en vez de esperar a la fase multiplataforma completa.

## What Changes

- Introducir un wrapper Tauri v2 mínimo en `src-tauri/` (Cargo workspace, config, entrypoint, capabilities por defecto, iconos base). No incluye tray, ni updater, ni notificaciones push.
- Agregar un comando Rust `set_app_badge(count: u32)` con implementaciones por plataforma:
  - Linux: señal D-Bus `com.canonical.Unity.LauncherEntry` (consumida por KDE Plasma 5.6+ y por GNOME con extensión Unity).
  - macOS: `NSApp.dockTile.badgeLabel`.
  - Windows: `ITaskbarList3::SetOverlayIcon` con número renderizado.
  - Stub no-op en cualquier otra plataforma.
- Modificar `src/hooks/useAppBadge.ts` para detectar entorno en runtime con un helper nuevo `isTauri()` (en `src/lib/platform.ts`). Si corre dentro de Tauri, invoca el comando Rust vía `@tauri-apps/api/core`. Si no, conserva el comportamiento actual (Badging API + Service Worker fallback) sin cambios observables.
- `@tauri-apps/api` se carga con dynamic import únicamente cuando `isTauri()` es verdadero, para que el bundle PWA no crezca.
- Agregar scripts `tauri:dev` / `tauri:build` en `package.json` y dependencias `@tauri-apps/cli` + `@tauri-apps/api`.
- `app.id` Tauri = `com.pendy.app`; el `desktop_entry` del `.desktop` debe coincidir con `StartupWMClass` para que KDE asocie la señal D-Bus a la ventana.

No hay cambios de comportamiento ni de UI para usuarios PWA. La regresión cero en la rama web es un requisito explícito.

## Capabilities

### New Capabilities

- `desktop-badge`: publicar el conteo de pendientes de hoy a un canal nativo de escritorio cuando la app corre dentro de un wrapper nativo, manteniendo la Badging API como ruta para PWA.
- `desktop-shell`: bootstrap mínimo del wrapper de escritorio Tauri v2 capaz de hostear la PWA y exponer comandos nativos (inicialmente solo el badge).

### Modified Capabilities

<!-- Ninguna. No hay specs previos en openspec/specs/. La rama PWA actual del badge queda preservada por la propia spec de desktop-badge (sección "PWA fallback"). -->

## Impact

- **Código nuevo**: `src-tauri/**`, `src/lib/platform.ts`.
- **Código modificado**: `src/hooks/useAppBadge.ts`, `package.json`, `.gitignore`, `vite.config.ts` (host/puerto fijo para Tauri dev).
- **Dependencias nuevas**: `@tauri-apps/cli`, `@tauri-apps/api` (npm); crates Rust `tauri`, `serde`, `zbus` (Linux), `objc2-app-kit` (macOS), `windows` crate (Windows).
- **Toolchain**: requiere Rust stable + dependencias de sistema para `tauri build` (libwebkit2gtk-4.1, librsvg, etc. en Arch/CachyOS). Sin impacto para usuarios que solo usan la PWA.
- **CI**: el pipeline actual de build web no cambia. Un job de `tauri build` Linux puede agregarse luego; no es parte de este cambio.
- **Bundle web**: sin crecimiento medible (dynamic import gateado por `isTauri()`).
- **Tests**: nuevos tests unitarios para `isTauri()` y para el branching en `useAppBadge` (mock de `window.__TAURI_INTERNALS__`). Sin cambios en suites existentes.
