/// Native badge publishing — dispatches to the OS-specific implementation.
///
/// Call `badge::set(count)` from Tauri commands. Returns `Ok(())` on all
/// platforms (even those with no native badge channel).

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "windows")]
mod windows;
#[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
mod stub;

/// Error type returned by all badge implementations.
#[derive(Debug, thiserror::Error)]
pub enum BadgeError {
    #[cfg(target_os = "linux")]
    #[error("D-Bus error: {0}")]
    DBus(#[from] zbus::Error),

    #[allow(dead_code)]
    #[error("badge error: {0}")]
    Other(String),
}

/// Set the application badge to `count`.
///
/// - `count == 0` clears the badge.
/// - On unsupported platforms this is a no-op.
pub async fn set(count: u32) -> Result<(), BadgeError> {
    #[cfg(target_os = "linux")]
    {
        linux::set(count).await
    }
    #[cfg(target_os = "macos")]
    {
        macos::set(count).await
    }
    #[cfg(target_os = "windows")]
    {
        windows::set(count).await
    }
    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        stub::set(count).await
    }
}
