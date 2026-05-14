/// macOS badge implementation via NSApp.dockTile.badgeLabel.
use super::BadgeError;
use objc2::rc::Retained;
use objc2_app_kit::{NSApplication, NSDockTile};
use objc2_foundation::NSString;

pub async fn set(count: u32) -> Result<(), BadgeError> {
    // Safety: Tauri guarantees this runs on the main thread when invoked via
    // `async fn` command on macOS (Tauri posts to the main dispatch queue).
    unsafe {
        let app = NSApplication::sharedApplication();
        let dock_tile: Retained<NSDockTile> = app.dockTile();
        let label: Retained<NSString> = if count > 0 {
            NSString::from_str(&count.to_string())
        } else {
            NSString::from_str("")
        };
        dock_tile.setBadgeLabel(Some(&label));
    }
    Ok(())
}
