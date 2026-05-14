# release-pipeline Specification

## Purpose
TBD - created by archiving change add-install-options-in-settings. Update Purpose after archive.
## Requirements
### Requirement: Workflow de release Linux automatizado

El repo SHALL contener un workflow de GitHub Actions en `.github/workflows/release.yml` que se dispare al pushear un tag con formato `v*.*.*` y produzca automáticamente la AppImage de Linux como asset de un draft release.

El workflow MUST:

- Correr en `ubuntu-22.04` (Ubuntu LTS, GLIBC 2.35 — compatible con la mayoría de distros modernas).
- Instalar las dependencias de sistema requeridas por Tauri 2 en Linux: `libwebkit2gtk-4.1-dev`, `libsoup-3.0-dev`, `libjavascriptcoregtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`, `libxdo-dev`.
- Cachear el toolchain de Rust y los artefactos de `cargo build` con `Swatinem/rust-cache@v2`.
- Cachear `node_modules` con `actions/setup-node@v4 + cache: 'pnpm'`.
- Usar `tauri-apps/tauri-action@v0` con `tagName: v__VERSION__`, `releaseName: 'Pendy v__VERSION__'`, `releaseDraft: true`, `prerelease: false`, `args: --target x86_64-unknown-linux-gnu`.
- Tener permisos `contents: write` en el `permissions:` del job para que pueda crear/editar releases.

#### Scenario: Push de tag dispara build

- **WHEN** un mantenedor ejecuta `git tag v0.1.0 && git push origin v0.1.0`
- **THEN** el workflow `release.yml` se ejecuta automáticamente sin intervención manual

#### Scenario: Artefactos generados

- **WHEN** el workflow termina exitosamente
- **THEN** existe un draft release en GitHub con título `Pendy v0.1.0` que contiene al menos un asset `.AppImage` y un asset `.deb` adjuntos

#### Scenario: Versionado consistente

- **WHEN** el tag es `v0.1.0`
- **THEN** la AppImage producida se nombra siguiendo el patrón `Pendy_0.1.0_amd64.AppImage` (formato standard de Tauri linux)

### Requirement: Releases en estado draft por seguridad

El workflow SHALL crear el release en estado `draft` para que el mantenedor revise los assets antes de publicar. NO se debe publicar automáticamente.

#### Scenario: Estado inicial del release

- **WHEN** el workflow termina
- **THEN** el release figura como "Draft" en la página de releases de GitHub, no visible para usuarios anónimos

#### Scenario: Promoción a release público

- **WHEN** el mantenedor abre el draft y presiona "Publish release"
- **THEN** el release queda público y la URL `https://github.com/juanmanuellosada/pendy/releases/latest` redirige a él, alimentando el botón "Descargar para Linux" de la UI

### Requirement: Reproducibilidad mínima

El workflow SHALL fijar la versión del CLI de Tauri usando la dependencia ya declarada en `package.json` (`@tauri-apps/cli` ^2). NO debe instalar Tauri CLI globalmente vía `cargo install` o similar — esto añadiría tiempo de build y divergencia entre la versión local del desarrollador y la del CI.

#### Scenario: Uso del binario local de pnpm

- **WHEN** el workflow ejecuta `tauri build`
- **THEN** lo hace vía el CLI instalado en `node_modules/.bin/tauri` (resuelto por la action de tauri o por `pnpm tauri build`), no por un binario global

