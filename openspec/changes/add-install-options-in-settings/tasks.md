## 1. Helpers en `platform.ts`

- [x] 1.1 Extender `src/lib/platform.ts` con `detectOS(): 'linux' | 'mac' | 'windows' | 'android' | 'ios' | 'other'`. Implementación con priorización `userAgentData.platform` → `userAgent` (ver `design.md` D4). SSR-safe (retorna `'other'` si no hay `window`).
- [x] 1.2 Agregar `isStandalonePwa(): boolean` que combina `matchMedia('(display-mode: standalone)').matches` con `navigator.standalone === true` (iOS). SSR-safe.
- [x] 1.3 Agregar `supportsBeforeInstallPrompt(): boolean` con heurística sobre UA (Chromium-based desktop → true, resto → false). SSR-safe.
- [x] 1.4 Extender `src/lib/platform.test.ts` con tests para los tres helpers nuevos: 4-5 casos cada uno cubriendo Linux/Mac/Windows/Android/iOS/SSR.
- [x] 1.5 Correr `pnpm test src/lib/platform.test.ts` y confirmar verde.

## 2. Hook `useInstallPrompt`

- [x] 2.1 Crear `src/hooks/useInstallPrompt.ts` con la firma definida en la spec. State inicial sync: llamar `detectOS()`, `isStandalonePwa()`, `isTauri()` para los flags iniciales.
- [x] 2.2 En `useEffect`, suscribir listeners para `beforeinstallprompt` (guardar el evento, hacer `preventDefault`, setear `canInstallPwa: true`) y `appinstalled` (descartar evento diferido, setear `isStandalone: true`).
- [x] 2.3 Implementar `promptInstallPwa(): Promise<'accepted' | 'dismissed' | 'unavailable'>`. Si no hay prompt diferido, retornar `'unavailable'`. Si hay, llamar `.prompt()`, esperar `userChoice`, retornar outcome y limpiar.
- [x] 2.4 Constante `LATEST_RELEASE_URL = 'https://github.com/juanmanuellosada/pendy/releases/latest'` exportada también, por si otros componentes la quieren reusar.
- [x] 2.5 Crear `src/hooks/useInstallPrompt.test.ts` cubriendo los 7 escenarios listados en la spec de testing. Seguir el patrón de `src/hooks/useAppBadge.test.ts` (mocks vía `Object.defineProperty`, dispatch manual de events, `renderHook` + `act`).
- [x] 2.6 Correr `pnpm test src/hooks/useInstallPrompt.test.ts` verde.

## 3. Componente `InstallOptions`

- [x] 3.1 Crear `src/components/settings/InstallOptions.tsx` siguiendo el patrón visual existente (ver `CalendarIntegrations.tsx` y `PushNotifications.tsx` como referencia): contenedor con `<section className="rounded-xl border p-4">` y `style={{ borderColor: 'var(--border-primary)' }}`. Título `<h2 className="text-sm font-semibold">Aplicación</h2>`.
- [x] 3.2 Estructura interna: descripción corta (1 oración) + dos sub-bloques (PwaBlock, DesktopBlock). En desktop (`md:` breakpoint) los dos bloques en grid 2 cols; en mobile stack vertical.
- [x] 3.3 Implementar `PwaBlock`: consume `useInstallPrompt()`, condicionales por estado según matriz en la spec. Usar copy exacta del spec ("Instalar PWA", "Ya está instalada como PWA", "Tu navegador no soporta...", instrucciones iOS).
- [x] 3.4 Implementar `DesktopBlock`: idem, con bot "Descargar para Linux" en Linux, "Próximamente para macOS/Windows", "Ya estás usando la versión de escritorio", y no renderizar si `os` es android/ios.
- [x] 3.5 Botón "Descargar para Linux" abre `LATEST_RELEASE_URL` con `window.open(url, '_blank', 'noopener,noreferrer')` o `<a target="_blank" rel="noopener noreferrer">`.
- [x] 3.6 Iconografía: usar Lucide React (`Download`, `Smartphone`, `Monitor`, `CheckCircle`, `Info`) consistente con otras secciones de Settings.

## 4. Integración en SettingsPage

- [x] 4.1 Importar `InstallOptions` en `src/pages/app/SettingsPage.tsx`.
- [x] 4.2 Insertar `<InstallOptions />` entre la sección "Tema" y la sección "General" (orden: Perfil → Tema → Aplicación → General → Push → Calendar).
- [ ] 4.3 Verificación manual en `pnpm dev`: navegar a Settings, confirmar que la sección aparece, que el patrón visual matchea las demás, que en desktop los bloques se ven en 2 columnas y en mobile en stack.

## 5. Workflow de release

- [x] 5.1 Crear `.github/workflows/release.yml` con trigger `push: tags: ['v*.*.*']`.
- [x] 5.2 Job único en `ubuntu-22.04` con `permissions: contents: write`.
- [x] 5.3 Steps: `actions/checkout@v4` con `fetch-depth: 0` (para que tauri-action lea git history si necesita).
- [x] 5.4 `pnpm/action-setup@v4` con `version: 10` (alineado con deploy.yml existente).
- [x] 5.5 `actions/setup-node@v4` con `node-version: '20'` y `cache: 'pnpm'`.
- [x] 5.6 `dtolnay/rust-toolchain@stable` + `Swatinem/rust-cache@v2` con `workspaces: './src-tauri -> target'`.
- [x] 5.7 Step `Install system deps`: `sudo apt-get update && sudo apt-get install -y libwebkit2gtk-4.1-dev libsoup-3.0-dev libjavascriptcoregtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libxdo-dev`.
- [x] 5.8 `pnpm install --frozen-lockfile`.
- [x] 5.9 `tauri-apps/tauri-action@v0` con env `GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}` y los inputs definidos en `design.md` D6.
- [x] 5.10 Validar el YAML con `yamllint` o `actionlint` localmente si están disponibles; si no, confiar en que GitHub lo valida al pushear.

## 6. Verificación end-to-end

- [x] 6.1 `pnpm test` — toda la suite verde (incluye platform + hook + tests existentes).
- [ ] 6.2 `pnpm dev` + visita en Brave: confirmar que la sección "Aplicación" aparece, el botón "Instalar PWA" funciona, y al aceptar la PWA pasa a "Ya está instalada".
- [ ] 6.3 `pnpm tauri:dev`: confirmar que dentro de la app nativa los dos bloques muestran los mensajes correctos ("Estás usando la versión de escritorio nativa" y "Ya estás usando la versión de escritorio") y no aparecen botones.
- [ ] 6.4 Firefox: confirmar que el bloque PWA muestra "Tu navegador no soporta instalación PWA" y el bloque desktop muestra el botón "Descargar para Linux".
- [ ] 6.5 Bump de versión en `package.json` y `src-tauri/tauri.conf.json` a `0.1.0` si no estaba. Crear tag `git tag v0.1.0` y push. Verificar en GitHub Actions que el workflow corre.
- [ ] 6.6 Una vez termina el workflow, verificar el draft release: debe tener un asset `Pendy_0.1.0_amd64.AppImage` adjunto.
- [ ] 6.7 Descargar la AppImage, hacerla ejecutable (`chmod +x`), ejecutarla. Confirmar que abre Pendy y que el badge funciona en KDE (sin necesidad de tocar `.desktop` files manualmente — la AppImage debería integrarlo).

## 7. Documentación y cierre

- [x] 7.1 Agregar al README la sección "Releases" con el comando `git tag v0.x.y && git push --tags` y la nota de que el release queda en draft hasta revisión manual.
- [x] 7.2 Validar el cambio: `openspec validate add-install-options-in-settings`.
- [ ] 7.3 Commit convencional: `feat: add install options in settings + linux release workflow`.
- [ ] 7.4 Archive: `openspec archive add-install-options-in-settings`.
