## Why

El sync de Google Calendar funciona en la web pero falla en la build de escritorio (Tauri, Linux/KDE) con un error `400 invalid_request` de Google. La causa: el `redirect_uri` de OAuth se construye con `window.location.origin`, que en Tauri es `tauri://localhost` — un esquema que Google rechaza antes de mostrar la pantalla de consentimiento. Sin un flujo de OAuth válido para escritorio, los usuarios de la app de escritorio no pueden conectar su calendario.

## What Changes

- Se añade un **flujo OAuth de loopback** para la plataforma de escritorio: un servidor HTTP local efímero en `http://127.0.0.1:8765` actúa como `redirect_uri` válido para Google.
- En la app de escritorio (detectada con el helper existente `isTauri()`), conectar el calendario abre el **navegador del sistema** para la pantalla de consentimiento de Google y captura el `code` mediante el servidor loopback, en lugar de un redirect de página completa.
- El flujo **web actual permanece sin cambios** (redirect de página a `${origin}${BASE_URL}app/settings`).
- Se añade un **comando Tauri (Rust)** que arranca el servidor loopback, abre el navegador y devuelve el `code` de autorización (y el `state`) al frontend, con timeout.
- Se añaden dos crates Rust mínimos en `src-tauri`: `tiny_http` (servidor loopback de un solo uso) y `open` (abrir el navegador del sistema vía `xdg-open`). **No se añaden plugins de Tauri** — se mantiene la superficie de Tauri mínima, alineada con la decisión del proyecto.
- `REDIRECT_URI` en el frontend pasa a depender de la plataforma.
- La Edge Function `calendar-oauth` **no cambia**: ya recibe `redirect_uri` del cliente y lo reenvía a Google; basta con que reciba la URI loopback en escritorio.
- **Paso manual requerido (documentado):** registrar `http://127.0.0.1:8765` como URI de redirección autorizada en el cliente OAuth de Google Cloud Console.

Fuera de alcance: el login con Google (`signInWithGoogle` en `useAuth.ts`) presenta el mismo defecto en escritorio. No se aborda en este cambio, pero podría reutilizar la misma técnica de loopback más adelante.

## Capabilities

### New Capabilities

- `calendar-oauth`: el flujo de autorización OAuth 2.0 con PKCE (Google) para conectar integraciones de calendario, incluyendo el comportamiento diferenciado entre web (redirect de página completa) y escritorio (servidor loopback local), y el contrato con la Edge Function de intercambio de código.

### Modified Capabilities

<!-- Ninguna: el sync de calendario no estaba cubierto por una spec previa. -->

## Impact

- **Frontend:** `src/hooks/useCalendarIntegrations.ts` (branching de plataforma en `useConnectCalendar`, `REDIRECT_URI` dependiente de plataforma), `src/services/calendarService.ts` (sin cambios de API; reutiliza `buildGoogleOAuthUrl`), `src/lib/platform.ts` (reuso de `isTauri()`).
- **Tauri / Rust:** `src-tauri/Cargo.toml` (nuevas dependencias), `src-tauri/src/lib.rs` (registrar el comando en `invoke_handler`) + nuevo módulo `oauth.rs`. Sin cambios en `capabilities/default.json` ni `tauri.conf.json` — los comandos propios de la app no requieren permisos extra en Tauri v2.
- **Dependencias nuevas:** `tiny_http` y `open` (crates Rust). Sin dependencias npm nuevas.
- **Infraestructura externa:** cliente OAuth de Google Cloud Console — añadir `http://127.0.0.1:8765` a las URIs de redirección autorizadas. Sin cambios en Supabase.
- **Sin cambios** en el esquema de base de datos ni en la Edge Function `calendar-oauth`.
