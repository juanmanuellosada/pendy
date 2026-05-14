## 1. Preparación del frontend (rama PWA intacta)

- [x] 1.1 Crear `src/lib/platform.ts` exportando `isTauri(): boolean` que chequee `typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window`.
- [x] 1.2 Agregar test unitario `src/lib/platform.test.ts`: caso PWA (window sin Tauri), caso Tauri (mock de `window.__TAURI_INTERNALS__`), caso SSR (`delete (global as any).window`).
- [x] 1.3 Modificar `src/hooks/useAppBadge.ts`: dentro del `useEffect`, si `isTauri()` → dynamic `import('@tauri-apps/api/core')` + `invoke('set_app_badge', { count: todayCount })` con try/catch que loguea sin propagar. Si no es Tauri, dejar el código actual exactamente como está (Badging API + postMessage al SW).
- [x] 1.4 Agregar test `src/hooks/useAppBadge.test.ts` (o extender existente): mockear `isTauri()` y verificar que (a) en Tauri se llama `invoke` y NO se llama `setAppBadge`; (b) en PWA se llama `setAppBadge` y NO se importa `@tauri-apps/api/core`.
- [x] 1.5 Correr `pnpm test` y confirmar verde.

## 2. Setup de Tauri (cero impacto sobre la PWA)

- [x] 2.1 Verificar toolchain Rust local: `rustc --version` (stable ≥ 1.77). Si falta, documentar en README cómo instalar (`rustup default stable`). **BLOCKER**: Rust no está instalado. Instalación documentada en README (tarea 6.1). Los archivos Rust se crean igualmente; `cargo check` queda pendiente hasta instalar Rust.
- [x] 2.2 Agregar a `package.json` (devDependencies): `@tauri-apps/cli` (^2). Agregar a dependencies: `@tauri-apps/api` (^2). Marcar `@tauri-apps/api` como `optionalDependencies` también para reforzar tree-shaking.
- [x] 2.3 Agregar scripts en `package.json`: `"tauri:dev": "tauri dev"`, `"tauri:build": "tauri build"`, `"tauri": "tauri"`.
- [x] 2.4 Ejecutar `pnpm install` para resolver lockfile.
- [x] 2.5 Crear `src-tauri/Cargo.toml` con `[package] name="pendy"`, `version="0.1.0"`, `edition="2021"`, `[lib] crate-type=["staticlib","cdylib","rlib"]`, deps: `tauri = { version = "2", features=["protocol-asset"] }`, `serde`, `serde_json`, `tauri-build` (build-deps), y deps de plataforma gated por `[target.'cfg(target_os="linux")'.dependencies] zbus = "4"` etc.
- [x] 2.6 Crear `src-tauri/build.rs` con `fn main() { tauri_build::build() }`.
- [x] 2.7 Crear `src-tauri/tauri.conf.json` con `productName="Pendy"`, `version="0.1.0"`, `identifier="com.pendy.app"`, `build.frontendDist="../dist"`, `build.devUrl="http://localhost:5173/pendy/"` (puerto existente del proyecto), `build.beforeDevCommand="pnpm dev"`, `build.beforeBuildCommand="pnpm build"`, `app.windows=[{title:"Pendy", width:1280, height:800}]`, `bundle.linux.deb.depends=[]`, `bundle.targets=["appimage"]`.
- [x] 2.8 Crear `src-tauri/icons/` con al menos `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`. Generados desde `public/icon-512.png` con ImageMagick.
- [x] 2.9 Crear `src-tauri/capabilities/default.json` permitiendo solo `core:default` y el permiso para el comando `set_app_badge`.
- [x] 2.10 Crear `src-tauri/src/main.rs` con `fn main() { pendy_lib::run() }` y `#[cfg_attr(not(debug_assertions), windows_subsystem = "windows")]`.
- [x] 2.11 Crear `src-tauri/src/lib.rs` que arme el `tauri::Builder`, registre el comando `set_app_badge` y exponga `pub fn run()`.
- [x] 2.12 Verificar `vite.config.ts`: agregar `host: '127.0.0.1'`, `clearScreen: false`, y `envPrefix: ['VITE_', 'TAURI_ENV_']`. Puerto conservado en 5173 (no se pisal el existente; `tauri.conf.json` apunta al mismo puerto).
- [x] 2.13 Agregar a `.gitignore`: `src-tauri/target/`, `src-tauri/gen/`.
- [x] 2.14 Ejecutar `cargo check --manifest-path src-tauri/Cargo.toml` y confirmar verde. ✅ Limpio sin warnings tras instalar Rust 1.95.0 + `webkit2gtk-4.1` + ajustes a `tauri.conf.json` (eliminado `desktopTemplate` mal anidado) y `Cargo.toml` (removido feature `protocol-asset` no usado).

## 3. Módulo `badge` en Rust

- [x] 3.1 Crear `src-tauri/src/badge/mod.rs` con `pub use platform_impl::set;` donde `platform_impl` es el submódulo correspondiente vía `#[cfg]`.
- [x] 3.2 Crear `src-tauri/src/badge/linux.rs`: función `pub async fn set(count: u32) -> Result<(), BadgeError>` que abre `zbus::Connection::session().await?` y emite la señal `com.canonical.Unity.LauncherEntry::Update` con `application://com.pendy.app.desktop` y un `HashMap<String, zbus::zvariant::Value>` con `count` (i64) y `count-visible` (bool).
- [x] 3.3 Crear `src-tauri/src/badge/macos.rs`: usar `objc2` + `objc2-app-kit` para `NSApp.dockTile.badgeLabel = (count > 0).then(|| count.to_string()).unwrap_or_default()`.
- [x] 3.4 Crear `src-tauri/src/badge/windows.rs`: stub inicial que use `windows` crate para llamar `ITaskbarList3::SetOverlayIcon` con un ícono genérico (presente/ausente). Render del número se deja para iteración posterior; TODO marcado.
- [x] 3.5 Crear `src-tauri/src/badge/stub.rs`: `pub async fn set(_count: u32) -> Result<(), BadgeError> { Ok(()) }`.
- [x] 3.6 Definir `#[derive(Debug, thiserror::Error)] pub enum BadgeError` en `mod.rs` con variantes para errores D-Bus y wrap genérico. `thiserror` agregado a Cargo.toml.
- [x] 3.7 En `lib.rs`, definir `#[tauri::command] async fn set_app_badge(count: u32) -> Result<(), String>` que llama a `badge::set(count).await.map_err(|e| e.to_string())`.
- [x] 3.8 Registrar el comando en el Builder: `.invoke_handler(tauri::generate_handler![set_app_badge])`.
- [x] 3.9 Ejecutar `cargo check` para todas las plataformas razonables (al menos Linux local). Confirmar sin warnings. ✅ Linux local: `Finished dev profile in 0.42s` sin warnings. `BadgeError::Other` marcado con `#[allow(dead_code)]` porque solo lo usa la rama Windows (no compilada en este host). macOS y Windows quedan pendientes de validación cruzada en sus toolchains respectivos.

## 4. Verificación local en KDE Plasma

- [x] 4.1 Ejecutar `pnpm tauri:dev` en la máquina KDE Plasma. ✅ Ventana abre OK tras instalar `webkit2gtk-4.1 libsoup3 librsvg gtk3 base-devel` y crear `.env.local`.
- [x] 4.2 Plasma Task Manager — la opción "Mostrar progreso e información de estado" viene activa por default en Plasma 6 en CachyOS. Sin acción extra requerida en este host.
- [x] 4.3 Badge visible con el conteo correcto sobre el ícono de Pendy en el Task Manager (confirmado por el usuario).
- [x] 4.4 Al limpiar pendientes el badge desaparece (validado via `count-visible: false`).
- [x] 4.5 Señal D-Bus emitida correctamente con `desktop-entry=com.pendy.app.desktop`. Se requirió crear manualmente `~/.local/share/applications/com.pendy.app.desktop` con `StartupWMClass=pendy` y refrescar `kbuildsycoca6 --noincremental`. En producción esto lo instalará el bundler — documentado en README.

## 5. Verificación de no-regresión PWA

- [x] 5.1 `pnpm build` corre limpio (validado por el executor; el dynamic import de `@tauri-apps/api` no infla el bundle web — Vite tree-shakea).
- [x] 5.2 PWA en Brave continúa funcionando en este mismo host (ventana detectada en KWin con class `brave-onpplmilgjolfcfdaejgigcedhomljmp-Default`). Verificación visual del badge en otros OS queda como follow-up open.
- [x] 5.3 `grep -r "__TAURI_INVOKE__\|@tauri-apps/api" dist/` no encontró referencias en el bundle PWA — branch gateada con dynamic import.
- [x] 5.4 N/A en este host: Plasma+Brave soportan Badging API. Degradación silenciosa cubierta por test unitario en `useAppBadge.test.ts`.

## 6. Documentación y cierre

- [x] 6.1 Agregar sección "Desktop build (experimental)" al `README.md`: cómo instalar deps (`rustup`, `webkit2gtk-4.1`, `libsoup3` en Arch/CachyOS), cómo correr `pnpm tauri:dev`, cómo activar indicadores en Plasma.
- [x] 6.2 Validar el cambio: `openspec validate add-desktop-badge-indicator`. **Resultado: Change 'add-desktop-badge-indicator' is valid**.
- [ ] 6.3 Commit con mensaje convencional: `feat: add native desktop badge fallback via minimal tauri shell`.
- [ ] 6.4 Una vez mergeado y verificado en runtime: `openspec archive add-desktop-badge-indicator`.
