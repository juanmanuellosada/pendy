/// Stub badge implementation for unsupported platforms (e.g., FreeBSD).
/// Always returns Ok(()) without any side effects.
use super::BadgeError;

pub async fn set(_count: u32) -> Result<(), BadgeError> {
    Ok(())
}
