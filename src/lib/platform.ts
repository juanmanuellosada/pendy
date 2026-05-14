/**
 * Runtime environment detection helpers.
 * Kept synchronous and side-effect-free so they are safe to call in render.
 */

/**
 * Returns true when the web bundle is served inside a Tauri native wrapper.
 * Tauri 2.x injects `window.__TAURI_INTERNALS__` at startup.
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}
