mod badge;

/// Tauri command: publish the badge count to the native desktop shell.
///
/// Called from the frontend via `invoke('set_app_badge', { count })`.
/// Errors are serialized to a String so that Tauri can forward them to JS.
#[tauri::command]
async fn set_app_badge(count: u32) -> Result<(), String> {
    badge::set(count).await.map_err(|e| e.to_string())
}

/// Entry point for both the binary (`main.rs`) and the dynamic library
/// used by `cargo tauri dev`.
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![set_app_badge])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
