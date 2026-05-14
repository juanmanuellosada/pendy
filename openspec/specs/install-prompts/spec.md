# install-prompts Specification

## Purpose
TBD - created by archiving change add-install-options-in-settings. Update Purpose after archive.
## Requirements
### Requirement: Hook de instalación expone estado de entorno

El sistema SHALL exponer un hook `useInstallPrompt()` en `src/hooks/useInstallPrompt.ts` que retorne un objeto con los siguientes campos, calculados a partir del entorno de ejecución:

- `canInstallPwa: boolean` — verdadero solo si el browser disparó `beforeinstallprompt` y todavía no se aceptó.
- `isStandalone: boolean` — verdadero si la app corre en modo standalone (`window.matchMedia('(display-mode: standalone)').matches`) o el browser indica `navigator.standalone === true` (iOS).
- `isTauri: boolean` — proxy del helper existente `isTauri()` para conveniencia.
- `os: 'linux' | 'mac' | 'windows' | 'android' | 'ios' | 'other'` — derivado de `navigator.userAgentData.platform` con fallback a `navigator.platform` y `navigator.userAgent`.
- `latestReleaseUrl: string` — URL constante apuntando a la página de releases más reciente del repo (`https://github.com/juanmanuellosada/pendy/releases/latest`).
- `promptInstallPwa(): Promise<'accepted' | 'dismissed' | 'unavailable'>` — invoca el prompt nativo. Retorna `'unavailable'` si no hay prompt diferido capturado.

El hook MUST suscribirse a `beforeinstallprompt` y `appinstalled` en el `useEffect`, y limpiar los listeners en el cleanup. La detección inicial (`isStandalone`, `os`) se calcula sincrónicamente en el primer render.

#### Scenario: PWA instalable

- **WHEN** el browser dispara `beforeinstallprompt`
- **THEN** `canInstallPwa` pasa a `true` y el evento queda guardado para que `promptInstallPwa()` pueda usarlo

#### Scenario: PWA ya instalada

- **WHEN** el browser dispara `appinstalled` o `display-mode: standalone` es verdadero al montar
- **THEN** `isStandalone === true` y `canInstallPwa === false`

#### Scenario: Detección de OS Linux

- **WHEN** `navigator.userAgentData.platform === 'Linux'` o el UA contiene `Linux`
- **THEN** `os === 'linux'`

#### Scenario: Detección de iOS

- **WHEN** el UA contiene `iPhone`/`iPad` o `navigator.maxTouchPoints > 1 && platform.startsWith('Mac')` (iPad masquerade)
- **THEN** `os === 'ios'`

#### Scenario: Llamada al prompt sin disponibilidad

- **WHEN** se llama `promptInstallPwa()` y nunca se disparó `beforeinstallprompt`
- **THEN** retorna `'unavailable'` sin lanzar errores

#### Scenario: Aceptación del prompt

- **WHEN** se llama `promptInstallPwa()`, el browser muestra el modal, y el usuario acepta
- **THEN** `userChoice.outcome === 'accepted'`, el hook descarta el evento diferido, y `canInstallPwa` pasa a `false`

### Requirement: Componente InstallOptions con estados por entorno

El sistema SHALL incluir un componente `InstallOptions` en `src/components/settings/InstallOptions.tsx` que renderiza dos bloques (uno PWA, uno escritorio) reusando el patrón visual de las secciones existentes en `SettingsPage` (`rounded-xl border p-4` con `borderColor: var(--border-primary)`). El componente NO recibe props y consume el hook directamente.

Cada bloque muestra título, descripción corta y un control de acción que cambia según el estado del entorno.

#### Scenario: Bloque PWA — instalable

- **WHEN** `canInstallPwa === true && !isStandalone && !isTauri`
- **THEN** se muestra un botón "Instalar PWA" habilitado. Click llama `promptInstallPwa()`.

#### Scenario: Bloque PWA — ya instalada

- **WHEN** `isStandalone === true`
- **THEN** se muestra el mensaje "Ya está instalada como PWA" sin botón

#### Scenario: Bloque PWA — corriendo en Tauri

- **WHEN** `isTauri === true`
- **THEN** se muestra el mensaje "Estás usando la versión de escritorio nativa" sin botón

#### Scenario: Bloque PWA — browser sin soporte

- **WHEN** `os === 'ios'`
- **THEN** se muestran instrucciones manuales: "Compartir → Agregar a pantalla de inicio"

#### Scenario: Bloque PWA — browser sin soporte (Firefox/etc)

- **WHEN** `canInstallPwa === false && !isStandalone && !isTauri && os !== 'ios'`
- **THEN** se muestra el mensaje "Tu navegador no soporta instalación PWA. Probá Chrome, Brave o Edge."

#### Scenario: Bloque escritorio — Linux

- **WHEN** `os === 'linux' && !isTauri`
- **THEN** se muestra un botón "Descargar para Linux" que abre `latestReleaseUrl` en una nueva pestaña (`target="_blank" rel="noopener noreferrer"`)

#### Scenario: Bloque escritorio — Tauri

- **WHEN** `isTauri === true`
- **THEN** se muestra el mensaje "Ya estás usando la versión de escritorio" sin botón

#### Scenario: Bloque escritorio — macOS o Windows

- **WHEN** `os === 'mac' || os === 'windows'` y no es Tauri
- **THEN** se muestra el mensaje "Próximamente para macOS/Windows" sin botón

#### Scenario: Bloque escritorio — Android o iOS

- **WHEN** `os === 'android' || os === 'ios'` y no es Tauri
- **THEN** el bloque de escritorio NO se renderiza (no aplica para mobile)

### Requirement: Integración en página de Settings

El sistema SHALL insertar el componente `<InstallOptions />` en `src/pages/app/SettingsPage.tsx` como una sección con título "Aplicación", ubicada inmediatamente después de la sección "Tema" y antes de "General". El título de sección sigue el patrón existente (`<h2 className="text-sm font-semibold">`).

#### Scenario: Orden de secciones

- **WHEN** un usuario entra a Settings
- **THEN** ve las secciones en este orden: Perfil → Tema → **Aplicación (nuevo)** → General → Push Notifications → Calendar Integrations

### Requirement: Helpers de plataforma reutilizables

El sistema SHALL extender `src/lib/platform.ts` con tres funciones puras, sincrónicas y sin side effects:

- `detectOS(): 'linux' | 'mac' | 'windows' | 'android' | 'ios' | 'other'`
- `isStandalonePwa(): boolean`
- `supportsBeforeInstallPrompt(): boolean` — heurística que retorna `true` para Chromium-based desktop browsers (Chrome/Edge/Brave/Opera) y `false` para Firefox, Safari, IE.

Estas funciones MUST funcionar en entornos SSR / Node tests (retornar `'other'`, `false`, `false` respectivamente cuando `window` no existe).

#### Scenario: SSR safe

- **WHEN** las funciones se invocan sin `window` global
- **THEN** retornan valores por defecto sin lanzar excepciones

#### Scenario: Detección de Linux

- **WHEN** `navigator.platform === 'Linux x86_64'`
- **THEN** `detectOS()` retorna `'linux'`

