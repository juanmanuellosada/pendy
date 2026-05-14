# desktop-shell Specification

## Purpose
TBD - created by archiving change add-desktop-badge-indicator. Update Purpose after archive.
## Requirements
### Requirement: Estructura mínima de Tauri v2

El proyecto SHALL contener una carpeta `src-tauri/` con la estructura mínima requerida por Tauri v2: `Cargo.toml`, `tauri.conf.json`, `src/main.rs`, `src/lib.rs`, `capabilities/default.json`, `icons/` y `build.rs`. El crate Rust MUST compilar sin warnings en Rust stable.

#### Scenario: Cargo check limpio

- **WHEN** se ejecuta `cargo check` dentro de `src-tauri/`
- **THEN** la compilación finaliza sin errores ni warnings de Rust

#### Scenario: Tauri info

- **WHEN** se ejecuta `pnpm tauri info`
- **THEN** la salida reporta versión `tauri = 2.x` y detecta correctamente la app

### Requirement: Identidad de aplicación coherente

El sistema SHALL definir un identificador de aplicación único, consistente entre:

- `tauri.conf.json > identifier = "com.pendy.app"`
- El `StartupWMClass` de la ventana producida en Linux
- El `desktop-entry` del archivo `.desktop` instalado por el bundler

Esta consistencia es necesaria para que KDE y otros entornos de escritorio Linux puedan correlacionar la señal D-Bus del badge con la ventana correcta.

#### Scenario: Coherencia de identidad

- **WHEN** se inspeccionan los tres campos anteriores tras un `tauri build`
- **THEN** los tres apuntan al mismo identificador derivable de `com.pendy.app`

### Requirement: Scripts de desarrollo y build

El sistema SHALL exponer en `package.json` los scripts `tauri:dev` (alias de `tauri dev`) y `tauri:build` (alias de `tauri build`), de forma que el flujo coincida con el resto de scripts del proyecto (`pnpm run tauri:dev`).

#### Scenario: Disponibilidad de scripts

- **WHEN** se ejecuta `pnpm run tauri:dev`
- **THEN** Tauri arranca el dev server de Vite y abre una ventana nativa apuntando a esa URL

### Requirement: Carga de la PWA dentro del WebView

El wrapper SHALL apuntar al mismo bundle Vite que sirve la PWA actual, sin requerir builds separados ni rutas distintas. El frontend MUST permanecer agnóstico al wrapper (excepto por el branching ya descrito en `desktop-badge`).

#### Scenario: Reutilización del bundle web

- **WHEN** Tauri arranca en modo dev
- **THEN** la URL cargada es la del Vite dev server (`http://localhost:1420` o el puerto fijado), sin un `index.html` específico de Tauri

#### Scenario: Producción

- **WHEN** se ejecuta `pnpm tauri build`
- **THEN** Tauri empaqueta el output de `pnpm build` (carpeta `dist/`) dentro del binario nativo

### Requirement: Capabilities con superficie mínima

El archivo `src-tauri/capabilities/default.json` SHALL otorgar a la ventana principal solo los permisos necesarios para ejecutar el comando `set_app_badge`. NO debe habilitar permisos sobre filesystem, shell, http, dialog, ni ningún plugin adicional en este cambio.

#### Scenario: Auditoría de capabilities

- **WHEN** se revisa `default.json`
- **THEN** la lista de permisos contiene únicamente `core:default` (o equivalente mínimo) más el permiso explícito para `set_app_badge`

