## Why

Después del cambio anterior (`add-desktop-badge-indicator`) Pendy tiene dos formas posibles de "instalarse" en la máquina del usuario:

1. **PWA**: el navegador ofrece instalar la web app — el botón nativo del browser aparece según heurística (no es predecible) y muchos usuarios no saben que existe.
2. **App nativa de escritorio (Tauri)**: solo accesible compilando uno mismo o descargando un binario que todavía no se publica. En KDE Plasma es la única forma de que el badge de pendientes se vea correctamente.

Hoy no hay nada en la UI que comunique esta decisión al usuario ni que le facilite ejecutarla. Si un visitante quiere "instalar Pendy", no sabe cómo. Si es un usuario de Linux/KDE, no sabe que existe una versión nativa que resuelve el badge.

Resolver con dos botones explícitos en Settings, cada uno con sus estados claros según el entorno actual.

## What Changes

- Agregar un hook `useInstallPrompt` que captura `beforeinstallprompt`, detecta `display-mode: standalone`, escucha `appinstalled`, identifica el OS del cliente, y expone helpers para disparar el flow de instalación PWA.
- Agregar un componente `InstallOptions` con dos sub-bloques (PWA / Escritorio) y mensajes contextuales según entorno (ya instalada, browser no soportado, próximamente, etc.).
- Integrar `InstallOptions` como sección nueva "Aplicación" en `SettingsPage.tsx`, reusando el patrón visual existente (`<section className="rounded-xl border p-4">` con vars CSS).
- Agregar workflow de GitHub Actions `release.yml` que builda la AppImage de Linux al pushear un tag `v*.*.*` y sube el artefacto como draft release.
- Extender `src/lib/platform.ts` con helpers `detectOS()`, `isStandalonePwa()` y `supportsBeforeInstallPrompt()`. La función `isTauri()` existente se reusa.

Sin cambios al wrapper Tauri, al Service Worker, ni al hook `useAppBadge`. La feature es estrictamente aditiva.

## Capabilities

### New Capabilities

- `install-prompts`: lógica + UI para ofrecer al usuario las dos vías de instalación (PWA vía `beforeinstallprompt`, app nativa vía descarga desde GitHub Releases), con detección de entorno y degradación graceful por browser / OS.
- `release-pipeline`: workflow de GitHub Actions que builda automáticamente la AppImage de Linux cuando se tagua un release, alimentando el botón "Descargar para Linux".

### Modified Capabilities

<!-- Ninguna. No hay specs previos en openspec/specs/ que toquen install flow ni release pipeline. -->

## Impact

- **Código nuevo**: `src/hooks/useInstallPrompt.ts`, `src/hooks/useInstallPrompt.test.ts`, `src/components/settings/InstallOptions.tsx`, `.github/workflows/release.yml`.
- **Código modificado**: `src/pages/app/SettingsPage.tsx` (insertar sección), `src/lib/platform.ts` (helpers nuevos).
- **Dependencias nuevas**: ninguna runtime. Para tests podría hacer falta verificar que `@testing-library/react` + `vitest` ya están — ambos están en uso (ver `useAppBadge.test.ts`).
- **Toolchain CI**: el nuevo workflow requiere que GitHub Actions tenga acceso a ubuntu-22.04 runners (gratis para repos públicos) y a `GITHUB_TOKEN` con permiso `contents: write` para crear releases (incluido en repos públicos por default). No hay secrets adicionales.
- **Bundle web**: crecimiento mínimo (un hook + un componente con copy). El asset path al icon-512 ya existe en `public/`.
- **Comportamiento existente**: cero impacto. La PWA actual sigue funcionando exactamente igual; los botones nuevos son aditivos.
- **Distribución**: a partir de este cambio, cada `git tag v0.x.y && git push --tags` produce un draft release en GitHub con la AppImage adjunta. El draft hay que publicarlo manualmente — esto es deliberado para revisar antes de cada release.
