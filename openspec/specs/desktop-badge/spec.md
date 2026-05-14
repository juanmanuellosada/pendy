# desktop-badge Specification

## Purpose
TBD - created by archiving change add-desktop-badge-indicator. Update Purpose after archive.
## Requirements
### Requirement: Badge count source of truth

El sistema SHALL calcular el "badge count" como la suma de tareas no completadas con `due_date = hoy` más hábitos pendientes para hoy (respetando la preferencia `showHabitsInToday` del usuario), reusando los hooks existentes `useTodayTasks`, `useTodayHabits` y `useHabitCompletions`. La fórmula de cálculo MUST permanecer idéntica entre la rama nativa (Tauri) y la rama PWA: solo cambia el canal de publicación.

#### Scenario: Cuenta consistente entre rutas

- **WHEN** un usuario tiene 3 tareas y 2 hábitos pendientes para hoy
- **THEN** el badge publicado vale `5` independientemente de si corre en Tauri o en PWA

#### Scenario: Cero pendientes

- **WHEN** no quedan tareas ni hábitos pendientes para hoy
- **THEN** el badge se limpia (count = 0 o equivalente a "sin badge") por todos los canales aplicables

### Requirement: Detección de entorno en runtime

El sistema SHALL exponer un helper `isTauri()` en `src/lib/platform.ts` que retorne `true` cuando el bundle web está siendo servido dentro del wrapper Tauri (presencia de `window.__TAURI_INTERNALS__` o `window.__TAURI__`) y `false` en cualquier otro caso. La detección MUST ser síncrona y sin efectos secundarios.

#### Scenario: PWA estándar

- **WHEN** el bundle se sirve en Chrome desktop sin Tauri
- **THEN** `isTauri()` retorna `false`

#### Scenario: Dentro de Tauri

- **WHEN** el bundle se sirve dentro del WebView de Tauri
- **THEN** `isTauri()` retorna `true`

#### Scenario: SSR/no window

- **WHEN** el código se evalúa en un entorno sin objeto `window` (tests Node, SSR)
- **THEN** `isTauri()` retorna `false` sin lanzar excepciones

### Requirement: Publicación nativa del badge en Tauri

Cuando `isTauri()` es verdadero, el sistema SHALL publicar el conteo invocando el comando Tauri `set_app_badge` con el payload `{ count: number }`. El import de `@tauri-apps/api/core` MUST ser dinámico (`await import(...)`) para que no exista en el bundle PWA.

#### Scenario: Publicación de conteo positivo en Tauri

- **WHEN** la app corre en Tauri y `badgeCount = 4`
- **THEN** se llama `invoke('set_app_badge', { count: 4 })` y NO se llama a `navigator.setAppBadge`

#### Scenario: Limpieza de badge en Tauri

- **WHEN** la app corre en Tauri y `badgeCount = 0`
- **THEN** se llama `invoke('set_app_badge', { count: 0 })` y el wrapper interpreta esto como "ocultar badge"

#### Scenario: Fallo del comando nativo

- **WHEN** la invocación al comando `set_app_badge` rechaza con un error
- **THEN** el error se captura y se loguea en consola pero NO se propaga a la UI ni se intenta fallback al Badging API (evitar comportamiento inconsistente entre arranques)

### Requirement: Conducta nativa por sistema operativo

El comando Rust `set_app_badge` SHALL implementar la publicación del badge usando el canal nativo apropiado al `target_os`:

- En **Linux**, MUST emitir una señal D-Bus `com.canonical.Unity.LauncherEntry::Update` apuntando a `application://<desktop-entry>.desktop`, con propiedades `count` (i64) y `count-visible` (bool). El `desktop-entry` MUST coincidir con el identificador definido en `tauri.conf.json > bundle.linux.deb.desktopTemplate` (o equivalente del bundler), y a su vez con el `StartupWMClass` de la ventana.
- En **macOS**, MUST setear `NSApp.dockTile.badgeLabel` con la representación string del número (vacío cuando `count == 0`).
- En **Windows**, MUST llamar `ITaskbarList3::SetOverlayIcon` con un ícono que represente el número (PNG renderizado on-the-fly o set de íconos pre-renderizados), pasando `null` cuando `count == 0`.
- En cualquier otro `target_os`, MUST ser un no-op que retorna `Ok(())`.

#### Scenario: KDE Plasma con count > 0

- **WHEN** el binario Linux corre en KDE Plasma con `count = 7`
- **THEN** Plasma Task Manager muestra "7" sobre el ícono de la ventana asociada al `desktop-entry`

#### Scenario: KDE Plasma con count == 0

- **WHEN** el binario Linux corre en KDE Plasma con `count = 0`
- **THEN** la propiedad `count-visible` se emite como `false` y Plasma deja de mostrar el badge

#### Scenario: Plataforma no soportada

- **WHEN** el binario corre en FreeBSD u otro `target_os` no contemplado
- **THEN** el comando completa sin error y sin efecto observable

### Requirement: Bus name único por instancia

En Linux, el sistema SHALL usar un _bus name_ en `org.pendy.AppBadge.<pid>` (o equivalente único por proceso) para registrar la conexión D-Bus, y SHALL liberar el recurso cuando el proceso termina. Esto evita conflictos entre múltiples instancias de Pendy ejecutándose en paralelo (raro pero posible en desarrollo).

#### Scenario: Dos instancias simultáneas

- **WHEN** se lanzan dos `tauri dev` simultáneos
- **THEN** ambos procesos registran conexiones D-Bus distintas sin chocar y cada uno controla el badge de su propia ventana

