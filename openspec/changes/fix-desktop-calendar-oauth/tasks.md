## 1. Configuración de Google Cloud Console (paso manual)

- [x] 1.1 Añadir `http://127.0.0.1:8765` a "Authorized redirect URIs" del cliente OAuth **Web** de Pendy en Google Cloud Console (APIs & Services → Credentials). El flujo de escritorio no funciona hasta completar este paso.

## 2. Comando loopback en Rust (`src-tauri`)

- [x] 2.1 Añadir los crates `tiny_http` y `open` a `src-tauri/Cargo.toml`, fijando versiones estables compatibles con la edición Rust 2021 del proyecto.
- [x] 2.2 Crear `src-tauri/src/oauth.rs` con la función `register_listener(handle)` que registra un `listen_any("start-oauth-loopback", ...)` en el setup hook (patrón de eventos, no comando Tauri — ver gotcha #4). El listener parsea `authUrl` del payload, llama a `run_loopback` en `spawn_blocking` (bind de `tiny_http::Server` en `127.0.0.1:8765`, `open::that(auth_url)`, `recv_timeout(300s)`, parseo del query string, respuesta HTML en español), y emite `oauth-loopback-result` con `{ code, state }` o `{ error }`.
- [x] 2.3 Asegurar que el trabajo bloqueante del servidor corre fuera del hilo principal (hilo dedicado o `spawn_blocking`), de modo que la UI no se congele.
- [x] 2.4 Declarar `mod oauth;` en `src-tauri/src/lib.rs` y llamar a `oauth::register_listener(app.handle())` en el `setup` hook del `tauri::Builder`, junto al listener de badge existente. No se registra ningún `invoke_handler` para oauth (no se usa un comando Tauri).
- [x] 2.5 Verificar que `cargo check` dentro de `src-tauri/` compila sin errores ni warnings.

## 3. Branching de plataforma en el frontend

- [x] 3.1 En `src/hooks/useCalendarIntegrations.ts`, hacer `REDIRECT_URI` dependiente de plataforma: `isTauri() ? 'http://127.0.0.1:8765' : <valor web actual>` (reusando `isTauri()` de `src/lib/platform.ts`).
- [x] 3.2 En `useConnectCalendar`, añadir la rama de escritorio: generar PKCE, guardar el `code_verifier` en `sessionStorage`, invocar `start_oauth_loopback` con la URL de `buildGoogleOAuthUrl`, validar `state === 'google'`, y disparar el intercambio con `useExchangeCalendarCode`. La rama web (`window.location.href`) permanece sin cambios.
- [x] 3.3 Invocar el comando Tauri vía `@tauri-apps/api/core` solo en la ruta de escritorio (import dinámico o aislado), sin romper ni alterar el bundle web.
- [x] 3.4 Mostrar los errores del flujo de escritorio (puerto ocupado, timeout, consentimiento denegado) con un toast de `sonner`.
- [x] 3.5 Confirmar que `useExchangeCalendarCode` envía el `REDIRECT_URI` correcto en el cuerpo del intercambio en ambas plataformas (coherencia con la URL de autorización).

## 5. Hardening de seguridad y robustez (post-review)

- [x] 5.1 **Guard de ejecución concurrente.** Añadir `static LOOPBACK_IN_PROGRESS: AtomicBool` en `oauth.rs`. Si el evento `start-oauth-loopback` llega mientras hay un run en curso, emitir inmediatamente `{ error: "Ya hay una conexión en curso…" }` y retornar. Transferir un guard RAII (`LoopbackGuard` que implementa `Drop`) a la tarea bloqueante para limpiar la bandera en todo camino de salida (éxito, error, panic).
- [x] 5.2 **`state` aleatorio por intento (CSRF).** Añadir `generateOAuthState()` en `calendarService.ts` (16 bytes de `crypto.getRandomValues`, base64url). Actualizar `buildGoogleOAuthUrl` para recibir `state` como parámetro en lugar de usar la constante `'google'`. En `useConnectCalendar`: generar el state, guardarlo en `sessionStorage` bajo `oauth_state_google`, e incluirlo en la URL. Validar el `state` devuelto contra el almacenado antes del intercambio (rama escritorio). Eliminar el valor de `sessionStorage` siempre tras el uso.
- [x] 5.3 **Validación del `state` en la rama web.** En `SettingsPage.tsx`, al capturar `?code=` al montar, validar `?state=` contra `sessionStorage.getItem('oauth_state_google')` (limpiar el key en ambos caminos). En caso de mismatch, descartar el code y loggear el error.
- [x] 5.4 **`percent_decode` UTF-8 correcto.** Cambiar la implementación en `oauth.rs` para acumular bytes decodificados en `Vec<u8>` y convertir con `String::from_utf8_lossy`, eliminando el cast `u8 as char` (Latin-1) que causaba mojibake en valores multi-byte.
- [x] 5.5 **Propagar el error real de Google.** `parse_query` ahora retorna `QueryOutcome::OAuthError(String)` con el valor literal del parámetro `error` (p.ej. `access_denied`). El loop de `run_loopback` lo propaga a `Err(err)` y el frontend lo muestra en el toast.
- [x] 5.6 **Loop sobre requests no-OAuth.** `run_loopback` ya no consume la primera request ciegamente. Itera dentro del presupuesto de 300 s usando slices de 5 s: requests sin `code` ni `error` reciben 404 y se ignoran; sólo una request con parámetros OAuth reales rompe el loop.
- [x] 5.7 **Timeout JS-side.** En `useConnectCalendar` (rama de escritorio), la promesa tiene un timeout de 310 s que rechaza la promesa y limpia `sessionStorage` si el lado Rust no emite dentro del presupuesto.

## 4. Verificación

- [x] 4.1 `pnpm build` y `pnpm lint` pasan sin errores.
- [ ] 4.2 Regresión web: en `pnpm dev`, conectar Google Calendar sigue funcionando con el redirect de página completa.
- [ ] 4.3 En `pnpm tauri:dev`, conectar Google Calendar: se abre el navegador del sistema, el consentimiento retorna por el loopback y la integración queda activa en la tabla `calendar_integrations`.
- [ ] 4.4 Caso de error: con el puerto `8765` ocupado, la UI muestra un mensaje de error legible y no se cuelga.
- [x] 4.5 Documentar el paso manual de Google Cloud Console (paso 1.1) en las notas de build de Tauri del proyecto.
