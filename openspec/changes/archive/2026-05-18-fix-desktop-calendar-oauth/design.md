## Context

El flujo de conexión de Google Calendar es un OAuth 2.0 con PKCE (S256):

1. `useConnectCalendar.startOAuth()` genera el par PKCE, guarda el `code_verifier` en `sessionStorage` y hace `window.location.href = buildGoogleOAuthUrl(challenge, REDIRECT_URI)`.
2. Tras el consentimiento, Google redirige a `REDIRECT_URI?code=...&state=google`.
3. `SettingsPage` lee `?code=` de la URL al montar y dispara `useExchangeCalendarCode`.
4. La Edge Function `calendar-oauth?action=exchange` recibe `{ code, code_verifier, redirect_uri }`, intercambia el código con Google (usando `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`) y persiste los tokens en `calendar_integrations`.

`REDIRECT_URI` se construye como `` `${window.location.origin}${import.meta.env.BASE_URL}app/settings` `` (`src/hooks/useCalendarIntegrations.ts:15`). En la web, `window.location.origin` es `https://…`. En la build de Tauri es `tauri://localhost`, un esquema que Google rechaza con `400 invalid_request`.

Restricciones relevantes:

- El cliente OAuth de Google es de tipo **Web application** (la Edge Function usa `client_secret`).
- Google solo acepta esquemas `http`/`https` como `redirect_uri`; `http://localhost` y `http://127.0.0.1` están permitidos como excepción de loopback.
- Para clientes Web, el `redirect_uri` debe coincidir **exactamente** (incluido el puerto) con uno registrado.
- El lado Tauri del proyecto se mantiene deliberadamente mínimo (solo el módulo `badge`, cero plugins de comunidad) tras una build v0.1.0 difícil de estabilizar.
- `isTauri()` (`src/lib/platform.ts`) ya existe y detecta el entorno Tauri vía `window.__TAURI_INTERNALS__`.

## Goals / Non-Goals

**Goals:**

- Que conectar Google Calendar funcione en la build de escritorio (Tauri/Linux) sin tocar el flujo web.
- Mantener intacta la Edge Function `calendar-oauth` y el esquema de base de datos.
- Reusar el cliente OAuth de Google existente (sin crear un cliente "Desktop" separado).
- No añadir plugins de Tauri; mantener la superficie de Tauri mínima.

**Non-Goals:**

- Arreglar el login con Google (`signInWithGoogle` en `useAuth.ts`), que tiene el mismo defecto en escritorio — fuera de alcance.
- Soporte de calendario en las builds móviles (Capacitor).

## Decisions

### D1 — Flujo de loopback HTTP en lugar de deep-link o WebView embebido

En escritorio, un servidor HTTP local efímero en `http://127.0.0.1:8765` actúa como `redirect_uri`. Es el patrón estándar para apps nativas y Google lo permite explícitamente.

- **Deep-link (`pendy://`)** — descartado: Google rechaza esquemas personalizados para clientes Web; obligaría a crear un cliente "Desktop" y a que la Edge Function eligiera credenciales por plataforma.
- **OAuth en WebView embebido** — descartado: Google bloquea OAuth en webviews embebidas ("este navegador puede no ser seguro").
- **Loopback** — elegido: compatible con el cliente Web existente, sin cambios en la Edge Function.

### D2 — Reusar el cliente Web con puerto fijo `8765`

Un cliente Web exige coincidencia exacta del `redirect_uri` incluido el puerto, así que el puerto debe ser **fijo** (los puertos dinámicos de loopback son una característica de los clientes "Desktop"). Reusar el cliente Web implica **cero cambios en la Edge Function** (mismas `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`). Un cliente "Desktop" separado obligaría a la Edge Function a ramificar credenciales por plataforma.

- Se usa `127.0.0.1` (no `localhost`) para evitar ambigüedad IPv4/IPv6.
- La cadena exacta `http://127.0.0.1:8765` se usa en los tres puntos: URL de autorización, parámetro del intercambio, y URI registrada en Google Cloud Console.

### D3 — Servidor loopback propio con `tiny_http` en lugar de `tauri-plugin-oauth`

El servidor se implementa como un comando Tauri propio en un módulo Rust nuevo (`src-tauri/src/oauth.rs`), usando el crate `tiny_http`.

- **`tauri-plugin-oauth`** — descartado: añade un plugin de comunidad con su propia superficie de API y rotación de versiones.
- **`tiny_http` propio** — elegido: crate diminuto y estable, control total del puerto, el timeout y la página HTML de respuesta (en español). Encaja con el patrón ya existente (el proyecto ya escribe Rust propio para el badge).

### D4 — Abrir el navegador con el crate `open` (sin plugin)

El comando Rust abre el navegador del sistema con `open::that(auth_url)` (usa `xdg-open` en Linux). Evita añadir `tauri-plugin-opener` + su capability + su paquete npm. Los comandos propios registrados en `invoke_handler` no requieren permisos extra en Tauri v2, así que **no hay cambios en `capabilities/default.json`**.

### D5 — `REDIRECT_URI` dependiente de plataforma, evaluado una vez

`REDIRECT_URI` pasa a ser `isTauri() ? 'http://127.0.0.1:8765' : <valor web actual>`. Al ser una constante de módulo evaluada una vez (el entorno no cambia en runtime), tanto `buildGoogleOAuthUrl` como el cuerpo del intercambio (`useExchangeCalendarCode`) usan automáticamente la URI correcta y coherente.

### D6 — Forma del flujo de conexión en escritorio

`useConnectCalendar` se vuelve dependiente de plataforma:

- **Web** — redireccionado de página completa; `SettingsPage` captura `?code=` y valida `?state=` contra `sessionStorage`.
- **Escritorio** — `startOAuth` ejecuta el flujo completo sin recarga de página: genera PKCE + `state` aleatorio → guarda ambos en `sessionStorage` → emite el evento `start-oauth-loopback` con `{ authUrl }` → escucha una vez `oauth-loopback-result` → recibe `{ code, state }` o `{ error }` → valida `state` contra el valor almacenado (CSRF) → dispara la mutación de intercambio (`useExchangeCalendarCode`). La rama de captura por URL de `SettingsPage` queda inerte en escritorio (no hay redirect).

**Patrón de IPC:** se usa `emit`/`listen` de `@tauri-apps/api/event` en lugar de `invoke` + `#[tauri::command]`. Esto es deliberado: el historial del proyecto (gotcha #4 en `tauri-linux-gotchas.md`) muestra que los comandos personalizados son rechazados en runtime por el ACL de Tauri (`"Command X not allowed by ACL"`) sin importar qué formato de permiso se use. Los eventos están permitidos por defecto vía `core:event:default` (incluido en `core:default`), sin ninguna configuración de capability.

El lado Rust (`oauth::register_listener` registrado en el `setup` hook) escucha el evento `start-oauth-loopback` y:

1. Comprueba la bandera atómica `LOOPBACK_IN_PROGRESS`. Si ya hay un intento en curso, emite inmediatamente `{ error: "Ya hay una conexión en curso…" }` y retorna. Si no, establece la bandera y transfiere un guard RAII a la tarea bloqueante para que la bandera se limpie en **todo** camino de salida (éxito, error, panic).
2. Parsea `authUrl` del payload.
3. Corre `run_loopback` en `spawn_blocking`: hace `bind` de `tiny_http::Server` en `127.0.0.1:8765`, abre el navegador con `open::that(auth_url)`, itera sobre requests dentro del presupuesto de 300 s ignorando las que no sean OAuth (404), procesa la primera request con `code` o `error`, responde una página HTML mínima en español.
4. Emite `oauth-loopback-result` con `{ code, state }` o `{ error }`. El valor de error de Google (p.ej. `access_denied`) se propaga literal en el campo `error`.

### D7 — `state` aleatorio por intento (protección CSRF)

El parámetro `state` de OAuth es ahora un valor aleatorio criptográfico generado por `generateOAuthState()` (16 bytes de `crypto.getRandomValues` codificados en base64url), distinto en cada intento. Se almacena en `sessionStorage` bajo `oauth_state_google` y se valida al recibir el callback — tanto en la rama de escritorio (before exchange) como en la rama web (`SettingsPage`). En caso de discrepancia se aborta el intercambio y se muestra un error. El valor se elimina de `sessionStorage` siempre, ya sea al validar exitosamente o al detectar el mismatch.

## Risks / Trade-offs

- **[Puerto `8765` ocupado]** → El comando devuelve un error claro y la UI muestra un toast; el usuario reintenta. Puerto poco común para minimizar colisiones; no se usan puertos dinámicos porque el cliente Web exige puerto fijo.
- **[El usuario cierra el navegador sin completar el consentimiento]** → El servidor expira a los 300 s y devuelve un error; sin fugas de recursos. El JS-side timeout (310 s) limpia `sessionStorage` y rechaza la promesa si el lado Rust no emite en ese plazo.
- **[La URI registrada en Google no coincide carácter a carácter]** → Google responde `400 invalid_request` o `redirect_uri_mismatch`. Mitigación: documentar la cadena exacta (`http://127.0.0.1:8765`, sin barra final ni path) y verificarla en pruebas.
- **[`xdg-open` no disponible o sin navegador por defecto]** → `open::that` falla; el comando devuelve error y la UI lo muestra. Poco probable en un escritorio KDE estándar.
- **[Confianza en el servidor local]** → El servidor escucha en `127.0.0.1` (solo loopback, no expuesto a la red), itera sobre requests no-OAuth con 404, y termina en la primera request real de OAuth. PKCE + `state` aleatorio protegen el intercambio.
- **[Segundo click en "conectar"]** → El guard `LOOPBACK_IN_PROGRESS` rechaza el intento concurrente con un mensaje claro antes de intentar bindear el puerto (evita el error confuso "port in use" en un reintento legítimo).

## Migration Plan

1. Implementar el módulo Rust y el branching del frontend (sin efecto en web).
2. **Paso manual del usuario:** en Google Cloud Console → APIs & Services → Credentials → cliente OAuth de Pendy → añadir `http://127.0.0.1:8765` a "Authorized redirect URIs". El flujo de escritorio no funciona hasta completar este paso.
3. Verificar en `pnpm tauri:dev` y en una build (`pnpm tauri:build`).
4. Rollback: el cambio está aislado por `isTauri()`; revertir el commit restaura el comportamiento previo sin afectar la web. La URI registrada en Google puede quedar sin efecto (no molesta).

## Open Questions

- ¿Google Cloud Console acepta `http://127.0.0.1:8765` sin path? Se espera que sí (excepción de loopback); confirmar al registrar la URI. Si exigiera un path, se usaría `http://127.0.0.1:8765/callback` de forma coherente en los tres puntos.
- Versiones exactas de los crates (`tiny_http`, `open`) — fijar a la última estable compatible con la edición Rust 2021 del proyecto al implementar.
