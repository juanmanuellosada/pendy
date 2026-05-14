## Context

Pendy ahora se distribuye en dos formas que coexisten:

1. **PWA** servida desde GitHub Pages bajo `https://juanmanuellosada.github.io/pendy/`. El navegador decide cuándo mostrar el prompt "Install" (heurística opaca). En KDE Plasma, el badge no funciona porque Plasma no implementa la Badging API.
2. **App nativa Tauri** (`add-desktop-badge-indicator` ya mergeado). Resuelve el badge en KDE vía D-Bus, pero hoy no se distribuye — el usuario tendría que compilar.

Falta el puente entre ambas: una UI que ayude al usuario a decidir cuál instalar, y la pipeline que produce el binario para que el botón "descargar nativa" no apunte al vacío.

Contexto relevante del repo (verificado en exploración):

- `SettingsPage.tsx` ya existe y usa el patrón `<section className="rounded-xl border p-4">` con `style={{ borderColor: 'var(--border-primary)' }}`. Header con `<h2 className="text-sm font-semibold">`.
- `src/components/settings/` existe con `CalendarIntegrations.tsx` y `PushNotifications.tsx`. Ahí va el componente nuevo.
- No hay shadcn Card; se usan secciones HTML con clases Tailwind + CSS vars.
- Patrón de hooks como `useIsMobile.ts` y `useTheme.ts` (init sync desde `matchMedia`, listeners en `useEffect`, cleanup). Ese es el molde.
- Tests con Vitest + `Object.defineProperty(navigator, ...)` ya tienen un ejemplo concreto en `useAppBadge.test.ts`.
- Repo en `git@github.com:juanmanuellosada/pendy.git` — la URL del botón "Descargar Linux" se hardcodea con ese path.

## Goals / Non-Goals

**Goals:**

- Usuario en Settings puede ver dos opciones claras de instalación con su estado.
- Click en "Instalar PWA" dispara el prompt nativo del browser cuando está disponible.
- Click en "Descargar para Linux" lleva al usuario a la página de releases más reciente.
- Cada `git tag vX.Y.Z` produce automáticamente una AppImage adjunta al draft release correspondiente.
- Cero impacto sobre los flows existentes (badge, PWA actual, Tauri dev).

**Non-Goals:**

- macOS y Windows builds (los stubs Tauri existen pero no se buildan en CI todavía).
- Auto-updater Tauri / in-app update banner / version check.
- Code signing / notarización.
- Deep links que abran la app desde la web (`pendy://`).
- Analytics sobre qué porcentaje elige cada opción.
- Publicar el release automáticamente (queda en draft a propósito).
- Cambiar la heurística del Badging API o el comportamiento del SW.

## Decisions

### D1. Un solo hook `useInstallPrompt`, no múltiples

Concentrar toda la detección de entorno + el prompt PWA en un único hook. Razón: el componente `InstallOptions` necesita varios estados correlacionados (`isStandalone`, `canInstallPwa`, `os`, `isTauri`). Si los repartimos en hooks separados, cada uno suscribe sus listeners y la UI tiene que componerlos manualmente. Un solo hook simplifica testing (un solo `renderHook` mocking distintos entornos).

**Alternativa descartada**: hooks granulares (`usePwaInstallable`, `useStandalone`, `useDetectOS`). Más "composable" pero overkill para un único punto de consumo.

### D2. Helpers puros en `platform.ts`, hook en `hooks/`

Tres funciones puras nuevas en `platform.ts`:

- `detectOS()` — síncrona, sin side effects, SSR safe.
- `isStandalonePwa()` — síncrona, lee `matchMedia` y `navigator.standalone`.
- `supportsBeforeInstallPrompt()` — heurística sobre `userAgent`.

El hook usa estas funciones para el state inicial y delega listeners (`beforeinstallprompt`, `appinstalled`) a su `useEffect`. Esta separación facilita los unit tests del hook (las funciones puras tienen su propio test trivial) y permite reusar `detectOS()` desde otros lugares sin invocar el hook.

**Por qué no meter todo en el hook**: `detectOS()` puede ser útil afuera (ej. un futuro banner solo-Linux), y mezclar lógica de detección con manejo de eventos hace el hook más difícil de testear.

### D3. Botón "Descargar Linux" apunta a `/releases/latest`, no al asset directo

URL del botón: `https://github.com/juanmanuellosada/pendy/releases/latest`.

**Por qué no al asset directo** (ej. `/releases/latest/download/Pendy_amd64.AppImage`): el filename incluye la versión (`Pendy_0.1.0_amd64.AppImage`), y GitHub no soporta wildcards. Para que un link directo funcione, habría que renombrar el asset en CI a un nombre fijo, o usar la API de GitHub para descubrir la URL en runtime.

La página de releases muestra todos los assets con sus nombres y tamaños — el usuario hace un click extra pero entiende qué está descargando. Es una decisión consciente: simplicidad sobre 1-click.

**Mitigación futura**: si en algún momento queremos 1-click, agregamos un endpoint serverless que redirija al asset latest, o renombramos el asset en CI a un nombre fijo (`Pendy_latest_amd64.AppImage`).

### D4. Detección de OS con priorización moderna→legacy

```ts
function detectOS() {
  if (typeof window === 'undefined') return 'other'
  const uaData = (navigator as any).userAgentData
  if (uaData?.platform) {
    const p = uaData.platform.toLowerCase()
    if (p.includes('linux')) return 'linux'
    if (p.includes('mac')) return 'mac'
    if (p.includes('win')) return 'windows'
    if (p.includes('android')) return 'android'
  }
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  if (/Linux/.test(ua)) return 'linux'
  if (/Mac/.test(ua)) return 'mac'
  if (/Windows/.test(ua)) return 'windows'
  return 'other'
}
```

`userAgentData` es la API moderna (Chromium) y no lleva fingerprinting risks. Fallback a `userAgent` para Firefox/Safari. iPad masquerade (Safari iPadOS reporta como Mac): se detecta con `navigator.maxTouchPoints > 1 && platform === 'Mac'`. En la práctica este check va en el hook después de obtener `os === 'mac'`.

### D5. Estados de bloque "PWA" sin mezclarse con "escritorio"

Cada bloque computa su propio estado a partir del hook. No hay un "modo" global. Esto evita matrices condicionales gigantes y permite que cada bloque tenga su propio mensaje en cada estado.

Implementación:

```tsx
function PwaBlock() {
  const { canInstallPwa, isStandalone, isTauri, os, promptInstallPwa } = useInstallPrompt()
  if (isTauri) return <Message>Estás usando la versión de escritorio nativa</Message>
  if (isStandalone) return <Message>Ya está instalada como PWA</Message>
  if (os === 'ios') return <IosInstructions />
  if (canInstallPwa) return <Button onClick={promptInstallPwa}>Instalar PWA</Button>
  return <Message>Tu navegador no soporta instalación PWA. Probá Chrome, Brave o Edge.</Message>
}
```

Misma estructura para `DesktopBlock`. La lógica condicional vive en el render, no en hooks ni en stores.

### D6. Workflow de release con `tauri-action`

`tauri-apps/tauri-action@v0` es la action oficial. Encapsula todo el flow: detecta el `productName` y `version` de `tauri.conf.json`, llama a `tauri build` con los targets pedidos, sube los assets resultantes al release.

Configuración clave:

```yaml
- uses: tauri-apps/tauri-action@v0
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    tagName: ${{ github.ref_name }}
    releaseName: 'Pendy ${{ github.ref_name }}'
    releaseBody: 'Versión publicada automáticamente. Edita estas notas antes de promover de draft a release.'
    releaseDraft: true
    prerelease: false
    args: --target x86_64-unknown-linux-gnu
```

**Por qué solo Linux ahora**: el usuario primario corre CachyOS/KDE. macOS/Windows requieren runners distintos en la matriz (que cuestan más minutos en runners privados; gratis en públicos pero suman compilación), código signing/notarización para que los binarios no salten warnings, y validación visual en cada OS. Cada uno justifica su propio cambio futuro.

**Alternativa considerada**: workflow manual (`workflow_dispatch`) sin tag. Descartada porque queremos asociar la versión al binario, y los tags son la convención más simple para eso.

### D7. Caché agresivo en CI para tiempos sub-10min

Sin caché, un `tauri build` desde scratch en Linux tarda ~8-12 min (mayoría del tiempo: compilar tauri 2.x + wry + crates D-Bus). Con caché:

- `actions/setup-node@v4` con `cache: 'pnpm'` → reutiliza `~/.local/share/pnpm/store`.
- `Swatinem/rust-cache@v2` → reutiliza `~/.cargo/registry`, `~/.cargo/git`, y `target/`.

Esperado post-caché: ~3-5 min por build incremental. Aceptable para releases poco frecuentes.

### D8. Tests del hook con `Object.defineProperty(navigator, ...)`

Ya hay precedente en `useAppBadge.test.ts`. Se mockea:

```ts
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({ matches: false }),
  })
  Object.defineProperty(navigator, 'platform', { writable: true, value: 'Linux x86_64' })
})
```

Para `beforeinstallprompt`, el test dispara manualmente: `window.dispatchEvent(new Event('beforeinstallprompt'))`. El test cleanup restaura los mocks vía `vi.restoreAllMocks()`.

## Risks / Trade-offs

- **[Riesgo] `beforeinstallprompt` no es estable cross-browser.** Chrome/Brave/Edge lo soportan, Firefox no, Safari no en desktop. Los tests cubren el path "no soportado" para evitar UI rota.
- **[Riesgo] `tauri-action` puede romper su API entre versiones.** Mitigación: pineado a `@v0` (major). Si rompen v0, revisar manualmente al actualizar a v1.
- **[Riesgo] El usuario tagua sin pensarlo y crea un draft release vacío** (porque el build falla). Mitigación: draft no se publica solo; el mantenedor revisa y borra si hace falta. Tasks incluye verificación post-build.
- **[Riesgo] Cache de Rust en CI se invalida con cada cambio de `Cargo.lock`**, lo que en proyectos Tauri pasa relativamente seguido (deps transitivas). Aceptado: en el peor caso el build tarda 12 min en lugar de 5.
- **[Trade-off] No 1-click download.** El usuario hace un click extra para elegir el asset en la página de releases. A favor: cero ambigüedad sobre qué versión bajan; los nombres de archivo siguen incluyendo versión (útil para soporte).
- **[Trade-off] Solo Linux ahora.** Usuarios de macOS/Windows ven "Próximamente" hasta que armemos el siguiente cambio. Aceptable para un proyecto de uso personal.

## Migration Plan

No hay migración de datos ni breaking changes. Cambio puramente aditivo. Deploy:

1. Merge a `main`. La PWA actual sigue funcionando idéntico.
2. Usuarios PWA: ven la nueva sección "Aplicación" en Settings la próxima vez que abran la app.
3. Botón "Descargar Linux" durante la fase intermedia (sin releases publicados) apunta a `/releases/latest` que muestra "There aren't any releases here yet". No es un error pero es feo.
4. **Primera release**: `git tag v0.1.0 && git push --tags` → workflow corre → draft release con AppImage → mantenedor revisa y publica → botón pasa a funcionar.

Rollback: revertir el commit. La sección de Settings desaparece, los archivos nuevos se borran. El workflow queda definido pero no se dispara sin tags. No hay state persistido.

## Open Questions

- **¿Versión inicial?** `0.1.0` matchea `tauri.conf.json` actual y `package.json`. La convención adoptada en este cambio es que la versión se bumpea manualmente antes de cada tag (sin auto-increment).
- **¿Notas de release manuales o auto-generadas?** El workflow pone un placeholder genérico. Auto-generar desde commit messages (`release-please`, `semantic-release`) queda para un cambio aparte. Por ahora el mantenedor edita el draft antes de publicar.
- **¿La AppImage usa `linuxdeploy` o `appimagetool`?** `tauri-action` decide internamente — históricamente usa `linuxdeploy` con `linuxdeploy-plugin-gtk`. No es algo que tengamos que configurar en este cambio.
- **¿Mostrar la AppImage al instalarla en KDE pide AppImageLauncher?** Si el usuario no lo tiene, la AppImage corre pero no se integra al menú. El README ya documenta esto. Considerar agregar tooltip en el botón "Descargar Linux" enlazando a la sección del README.
