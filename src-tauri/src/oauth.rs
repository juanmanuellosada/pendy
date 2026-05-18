use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};
use tauri::{Emitter, Listener};

// ─── Concurrent-run guard ─────────────────────────────────────────────────────

/// Process-wide flag: `true` while a loopback run is in progress.
static LOOPBACK_IN_PROGRESS: AtomicBool = AtomicBool::new(false);

/// RAII guard that clears `LOOPBACK_IN_PROGRESS` when dropped, ensuring the
/// flag is always cleared regardless of the exit path (success, error, panic).
struct LoopbackGuard;

impl Drop for LoopbackGuard {
    fn drop(&mut self) {
        LOOPBACK_IN_PROGRESS.store(false, Ordering::SeqCst);
    }
}

// ─── Internal types ───────────────────────────────────────────────────────────

/// Intermediate result from the loopback server (used internally before
/// serialisation into `OAuthResultPayload`).
#[derive(serde::Serialize)]
struct OAuthResult {
    code: String,
    state: String,
}

/// Parsed OAuth query-string parameters; distinguishes the three cases Google
/// can return: success (`code`), error (`error`), or neither (unrelated request).
enum QueryOutcome {
    OAuthCode(OAuthResult),
    OAuthError(String),
    NotOAuth,
}

/// Parse `code`, `state`, and `error` from a query string like `?code=...&state=...`.
fn parse_query(query: &str) -> QueryOutcome {
    let query = query.trim_start_matches('?');
    let mut code: Option<String> = None;
    let mut state: Option<String> = None;
    let mut error: Option<String> = None;

    for pair in query.split('&') {
        let mut parts = pair.splitn(2, '=');
        let key = parts.next().unwrap_or("").trim();
        let val = parts
            .next()
            .map(|v| {
                // Minimal percent-decode: '+' → ' ' and %XX sequences
                let v = v.replace('+', " ");
                percent_decode(&v)
            })
            .unwrap_or_default();

        match key {
            "code" => code = Some(val),
            "state" => state = Some(val),
            "error" => error = Some(val),
            _ => {}
        }
    }

    if let Some(err) = error {
        eprintln!("[oauth] Google returned error: {err}");
        return QueryOutcome::OAuthError(err);
    }

    match code {
        Some(c) => QueryOutcome::OAuthCode(OAuthResult {
            code: c,
            state: state.unwrap_or_default(),
        }),
        None => QueryOutcome::NotOAuth,
    }
}

/// Minimal percent-decoder: collects decoded bytes into a Vec<u8> then converts
/// to a String with `from_utf8_lossy` so multi-byte UTF-8 sequences are handled
/// correctly instead of casting individual bytes to `char` (Latin-1 mojibake).
fn percent_decode(s: &str) -> String {
    let mut out: Vec<u8> = Vec::with_capacity(s.len());
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(hex) = std::str::from_utf8(&bytes[i + 1..i + 3]) {
                if let Ok(byte) = u8::from_str_radix(hex, 16) {
                    out.push(byte);
                    i += 3;
                    continue;
                }
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// HTML page shown in the browser after the OAuth redirect is captured.
const SUCCESS_HTML: &str = r#"<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pendy — Conexión completada</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center;
           justify-content: center; height: 100vh; margin: 0; background: #F5F7FA; }
    .card { background: #fff; border-radius: 12px; padding: 40px 48px; text-align: center;
            box-shadow: 0 4px 24px rgba(0,0,0,.08); max-width: 400px; }
    h1 { color: #283B56; font-size: 1.4rem; margin-bottom: .5rem; }
    p  { color: #6B7280; line-height: 1.5; margin: 0; }
    .check { font-size: 3rem; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="check">✅</div>
    <h1>¡Conexión completada!</h1>
    <p>Podés cerrar esta pestaña y volver a Pendy.</p>
  </div>
</body>
</html>"#;

/// HTML page shown when Google returned an error or the request was malformed.
const ERROR_HTML: &str = r#"<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pendy — Error de conexión</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center;
           justify-content: center; height: 100vh; margin: 0; background: #F5F7FA; }
    .card { background: #fff; border-radius: 12px; padding: 40px 48px; text-align: center;
            box-shadow: 0 4px 24px rgba(0,0,0,.08); max-width: 400px; }
    h1 { color: #EC1E2A; font-size: 1.4rem; margin-bottom: .5rem; }
    p  { color: #6B7280; line-height: 1.5; margin: 0; }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">❌</div>
    <h1>Error al conectar</h1>
    <p>Hubo un error durante la autorización. Podés cerrar esta pestaña y reintentar desde Pendy.</p>
  </div>
</body>
</html>"#;

/// Payload sent by the frontend to trigger the loopback server.
#[derive(serde::Deserialize)]
struct StartOAuthPayload {
    #[serde(rename = "authUrl")]
    auth_url: String,
}

/// Payload emitted back to the frontend when the loopback completes.
#[derive(serde::Serialize, Clone)]
#[serde(untagged)]
enum OAuthResultPayload {
    Ok { code: String, state: String },
    Err { error: String },
}

/// Runs the loopback work synchronously (intended to run on a dedicated thread
/// via `spawn_blocking`).
///
/// The server loops on requests within the 300 s budget:
/// - Non-OAuth requests (favicon, preconnect, etc.) receive a 404 and are ignored.
/// - The first request carrying `?code=` or `?error=` is the real OAuth callback.
fn run_loopback(auth_url: &str) -> Result<OAuthResult, String> {
    // 1. Bind the loopback server.
    let server = tiny_http::Server::http("127.0.0.1:8765")
        .map_err(|e| format!("No se pudo iniciar el servidor OAuth (puerto 8765 en uso o error: {e}). Cerrá otras instancias de Pendy e intentá de nuevo."))?;

    // 2. Open the system browser.
    open::that(auth_url)
        .map_err(|e| format!("No se pudo abrir el navegador del sistema: {e}"))?;

    // 3. Loop within the 300 s budget, ignoring non-OAuth requests.
    let deadline = Instant::now() + Duration::from_secs(300);

    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            return Err("La conexión expiró (300 s). Volvé a intentarlo.".to_string());
        }

        // recv_timeout with a short slice so we can recheck the deadline.
        let slice = remaining.min(Duration::from_secs(5));
        let request = match server.recv_timeout(slice) {
            Ok(Some(r)) => r,
            Ok(None) => continue, // slice expired, loop to recheck deadline
            Err(e) => return Err(format!("Error al escuchar la respuesta OAuth: {e}")),
        };

        // 4. Extract the query string.
        //    Google redirects to: /?code=...&state=... or /?error=...
        let url = request.url().to_owned();
        let query = url.find('?').map(|i| &url[i..]).unwrap_or("");

        // 5. Check whether this is the real OAuth callback.
        match parse_query(query) {
            QueryOutcome::NotOAuth => {
                // Browser sent something unrelated (favicon, preconnect…); ignore it.
                let not_found = tiny_http::Response::from_string("Not found")
                    .with_status_code(404);
                let _ = request.respond(not_found);
                // continue waiting
            }
            QueryOutcome::OAuthError(err) => {
                // Google returned an explicit error (e.g. access_denied).
                let response = tiny_http::Response::from_string(ERROR_HTML)
                    .with_header(
                        "Content-Type: text/html; charset=utf-8"
                            .parse::<tiny_http::Header>()
                            .expect("static header is valid"),
                    );
                let _ = request.respond(response);
                return Err(err);
            }
            QueryOutcome::OAuthCode(result) => {
                // Success: respond with the success page and return the code.
                let response = tiny_http::Response::from_string(SUCCESS_HTML)
                    .with_header(
                        "Content-Type: text/html; charset=utf-8"
                            .parse::<tiny_http::Header>()
                            .expect("static header is valid"),
                    );
                let _ = request.respond(response);
                return Ok(result);
            }
        }
    }
}

/// Register an event listener for "start-oauth-loopback" in the Tauri setup
/// hook.  Uses the event-based pattern (gotcha #4) so no ACL configuration is
/// needed: `core:event:default` (included in `core:default`) covers both
/// `emit` and `listen`.
///
/// Expected inbound payload: `{ "authUrl": "https://accounts.google.com/..." }`
/// Emits back on "oauth-loopback-result":
///   - success: `{ "code": "...", "state": "..." }`
///   - failure: `{ "error": "..." }`
///
/// If a run is already in progress, immediately emits an error and does nothing
/// else (concurrent-run guard via `LOOPBACK_IN_PROGRESS`).
pub fn register_listener(handle: &tauri::AppHandle) {
    let handle = handle.clone();
    handle.clone().listen_any("start-oauth-loopback", move |event| {
        eprintln!("[oauth] event received, raw payload: {:?}", event.payload());

        // ── Concurrent-run guard ──────────────────────────────────────────────
        // Use compare_exchange so only one goroutine can set the flag at a time.
        if LOOPBACK_IN_PROGRESS
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_err()
        {
            eprintln!("[oauth] already in progress, rejecting concurrent attempt");
            let _ = handle.emit(
                "oauth-loopback-result",
                OAuthResultPayload::Err {
                    error: "Ya hay una conexión en curso. Esperá a que termine o reiniciá Pendy."
                        .to_string(),
                },
            );
            return;
        }
        // The LoopbackGuard will clear the flag on every exit path via Drop.
        let _guard = LoopbackGuard;

        let payload: StartOAuthPayload = match serde_json::from_str(event.payload()) {
            Ok(p) => p,
            Err(e) => {
                eprintln!("[oauth] invalid payload: {e}");
                // `_guard` drops here, clearing LOOPBACK_IN_PROGRESS automatically.
                let _ = handle.emit(
                    "oauth-loopback-result",
                    OAuthResultPayload::Err {
                        error: format!("Payload inválido: {e}"),
                    },
                );
                return;
            }
        };

        let auth_url = payload.auth_url.clone();
        let handle_inner = handle.clone();

        // Transfer ownership of the guard into the spawned task so that the
        // flag stays set until the blocking work finishes.  Forgetting the
        // outer guard prevents a double-clear when the event-callback closure
        // returns after `spawn_blocking` has already taken responsibility.
        std::mem::forget(_guard);

        tauri::async_runtime::spawn_blocking(move || {
            // RAII guard: clears `LOOPBACK_IN_PROGRESS` on every exit path.
            let _guard = LoopbackGuard;

            eprintln!("[oauth] starting loopback for url={}", auth_url);
            let result_payload = match run_loopback(&auth_url) {
                Ok(r) => {
                    eprintln!("[oauth] loopback succeeded, code present");
                    OAuthResultPayload::Ok {
                        code: r.code,
                        state: r.state,
                    }
                }
                Err(e) => {
                    eprintln!("[oauth] loopback failed: {e}");
                    OAuthResultPayload::Err { error: e }
                }
            };
            if let Err(e) = handle_inner.emit("oauth-loopback-result", result_payload) {
                eprintln!("[oauth] failed to emit result: {e}");
            }
        });
    });
    eprintln!("[oauth] listener registered for 'start-oauth-loopback'");
}
