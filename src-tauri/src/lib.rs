mod badge;
mod oauth;

use serde::Deserialize;
use tauri::Listener;

#[derive(Deserialize)]
struct BadgePayload {
    count: u32,
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            eprintln!("[badge] setup hook running, registering listener for 'set-app-badge'");
            let handle = app.handle().clone();
            let id = handle.listen_any("set-app-badge", move |event| {
                eprintln!("[badge] event received, raw payload: {:?}", event.payload());
                let payload: BadgePayload = match serde_json::from_str(event.payload()) {
                    Ok(p) => p,
                    Err(e) => {
                        eprintln!("[badge] invalid payload: {e}");
                        return;
                    }
                };
                eprintln!("[badge] parsed count={}", payload.count);
                tauri::async_runtime::spawn(async move {
                    match badge::set(payload.count).await {
                        Ok(()) => eprintln!("[badge] D-Bus signal emitted for count={}", payload.count),
                        Err(e) => eprintln!("[badge] set failed: {e}"),
                    }
                });
            });
            eprintln!("[badge] listener registered with id={id}");

            oauth::register_listener(app.handle());

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
