/// Windows badge implementation via ITaskbarList3::SetOverlayIcon.
///
/// TODO: Render a proper numeric icon (1-9 and "9+") using the `image` crate
/// or pre-baked resources. Currently uses a presence/absence overlay only.
use super::BadgeError;
use windows::{
    core::HRESULT,
    Win32::{
        Foundation::HWND,
        System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED},
        UI::Shell::{ITaskbarList3, TaskbarList},
    },
};

pub async fn set(count: u32) -> Result<(), BadgeError> {
    // TODO: Implement per-number icon rendering. This stub sets a generic
    // "has items" overlay when count > 0 and clears it when count == 0.
    unsafe {
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        let taskbar: ITaskbarList3 =
            CoCreateInstance(&TaskbarList, None, CLSCTX_INPROC_SERVER).map_err(|e| {
                BadgeError::Other(format!("CoCreateInstance failed: {}", HRESULT(e.code().0)))
            })?;

        // HWND(0) targets the foreground window of this process.
        // For a real implementation, retrieve the actual window HWND via
        // tauri::Window::hwnd() or the winapi GetForegroundWindow().
        taskbar
            .SetOverlayIcon(HWND(std::ptr::null_mut()), None, None)
            .map_err(|e| BadgeError::Other(format!("SetOverlayIcon failed: {}", HRESULT(e.code().0))))?;
        let _ = count; // TODO: use count to select overlay icon
    }
    Ok(())
}
