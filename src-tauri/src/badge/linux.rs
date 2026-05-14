/// Linux badge implementation via D-Bus Unity Launcher Entry protocol.
///
/// KDE Plasma 5.6+ and GNOME (with the Unity-compatible extension) both
/// consume the `com.canonical.Unity.LauncherEntry::Update` signal. The
/// `desktop-entry` part of the signal target MUST match the basename of the
/// `.desktop` file that the running window is associated with — otherwise
/// Plasma silently drops the signal.
///
/// AppImageLauncher renames installed .desktop files to
/// `appimagekit_<hash>-<Name>.desktop`, where the hash is per-installation.
/// We discover the right basename at runtime by scanning XDG application
/// directories for a `.desktop` with `StartupWMClass` matching our window
/// class.
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::OnceLock;
use zbus::{Connection, zvariant::Value};

use super::BadgeError;

/// Window class set by Tauri/wry on Linux. Comes from `productName` in
/// `tauri.conf.json`. Must match the `StartupWMClass=` value in the
/// `.desktop` that the running app is launched from.
const WM_CLASS: &str = "Pendy";

/// Fallback used if no matching `.desktop` is found in XDG paths (covers
/// the "user just runs the AppImage with no integration" case — badge
/// won't actually display in that scenario anyway, since Plasma has no
/// window-to-desktop association either way).
const FALLBACK_DESKTOP_ENTRY: &str = "com.pendy.app";

fn xdg_application_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Some(data_home) = std::env::var_os("XDG_DATA_HOME") {
        let mut p = PathBuf::from(data_home);
        p.push("applications");
        dirs.push(p);
    } else if let Some(home) = std::env::var_os("HOME") {
        let mut p = PathBuf::from(home);
        p.push(".local/share/applications");
        dirs.push(p);
    }
    if let Some(data_dirs) = std::env::var_os("XDG_DATA_DIRS") {
        for d in std::env::split_paths(&data_dirs) {
            let mut p = PathBuf::from(d);
            p.push("applications");
            dirs.push(p);
        }
    } else {
        dirs.push(PathBuf::from("/usr/local/share/applications"));
        dirs.push(PathBuf::from("/usr/share/applications"));
    }
    dirs
}

fn discover_desktop_entry() -> String {
    for dir in xdg_application_dirs() {
        let Ok(entries) = fs::read_dir(&dir) else { continue };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("desktop") {
                continue;
            }
            let Ok(content) = fs::read_to_string(&path) else { continue };
            let mut in_main_section = true;
            for line in content.lines() {
                let line = line.trim();
                if line.starts_with('[') {
                    in_main_section = line == "[Desktop Entry]";
                    continue;
                }
                if !in_main_section { continue; }
                if let Some(value) = line.strip_prefix("StartupWMClass=") {
                    if value.trim() == WM_CLASS {
                        if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                            eprintln!("[badge] resolved desktop entry: {stem}");
                            return stem.to_string();
                        }
                    }
                }
            }
        }
    }
    eprintln!("[badge] no .desktop with StartupWMClass={WM_CLASS} found; falling back to {FALLBACK_DESKTOP_ENTRY}");
    FALLBACK_DESKTOP_ENTRY.to_string()
}

fn desktop_entry() -> &'static str {
    static ENTRY: OnceLock<String> = OnceLock::new();
    ENTRY.get_or_init(discover_desktop_entry)
}

pub async fn set(count: u32) -> Result<(), BadgeError> {
    let conn = Connection::session().await?;

    let mut props: HashMap<&str, Value<'_>> = HashMap::new();
    props.insert("count", Value::I64(count as i64));
    props.insert("count-visible", Value::Bool(count > 0));

    let app_uri = format!("application://{}.desktop", desktop_entry());

    conn.emit_signal(
        None::<&str>,
        "/com/pendy/AppBadge",
        "com.canonical.Unity.LauncherEntry",
        "Update",
        &(app_uri, props),
    )
    .await?;

    Ok(())
}
