/// Linux badge implementation via D-Bus Unity Launcher Entry protocol.
///
/// KDE Plasma 5.6+ and GNOME (with the Unity-compatible extension) both
/// consume the `com.canonical.Unity.LauncherEntry::Update` signal.
///
/// The `desktop-entry` string MUST match the `.desktop` filename that
/// Tauri's bundler installs (derived from `tauri.conf.json > identifier`).
use std::collections::HashMap;
use zbus::{Connection, zvariant::Value};

use super::BadgeError;

/// Application identifier — must match `tauri.conf.json > identifier` and
/// the `StartupWMClass` of the produced `.desktop` file.
const DESKTOP_ENTRY: &str = "com.pendy.app";

pub async fn set(count: u32) -> Result<(), BadgeError> {
    let conn = Connection::session().await?;

    // Build the properties map expected by the Unity Launcher Entry spec.
    let mut props: HashMap<&str, Value<'_>> = HashMap::new();
    props.insert("count", Value::I64(count as i64));
    props.insert("count-visible", Value::Bool(count > 0));

    // The desktop entry URI that KDE/GNOME uses to correlate the signal
    // with the right application window.
    let app_uri = format!("application://{}.desktop", DESKTOP_ENTRY);

    conn.emit_signal(
        // No destination bus name — this is a broadcast signal.
        None::<&str>,
        // Object path for this process's badge endpoint.
        "/com/pendy/AppBadge",
        // Interface name.
        "com.canonical.Unity.LauncherEntry",
        // Signal name.
        "Update",
        // Payload: (app_uri, properties_map)
        &(app_uri, props),
    )
    .await?;

    Ok(())
}
