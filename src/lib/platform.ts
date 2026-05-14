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

export type OS = 'linux' | 'mac' | 'windows' | 'android' | 'ios' | 'other'

/**
 * Detects the current operating system.
 * Prefers the modern `navigator.userAgentData.platform` API (Chromium) and
 * falls back to `navigator.userAgent` for Firefox/Safari.
 * SSR-safe: returns 'other' when `window` is not defined.
 */
export function detectOS(): OS {
  if (typeof window === 'undefined') return 'other'

  const uaData = (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData
  if (uaData?.platform) {
    const p = uaData.platform.toLowerCase()
    if (p.includes('linux')) return 'linux'
    if (p.includes('win')) return 'windows'
    if (p.includes('android')) return 'android'
    if (p.includes('mac')) {
      // iPad masquerade: Safari on iPadOS reports as Mac but has touch points
      if (navigator.maxTouchPoints > 1) return 'ios'
      return 'mac'
    }
  }

  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  if (/Linux/.test(ua)) return 'linux'
  if (/Mac/.test(ua)) {
    // iPad masquerade via userAgent
    if (navigator.maxTouchPoints > 1) return 'ios'
    return 'mac'
  }
  if (/Windows/.test(ua)) return 'windows'
  return 'other'
}

/**
 * Returns true when the app is running in standalone (installed) mode.
 * Covers both Chrome/Firefox `display-mode: standalone` and the iOS
 * `navigator.standalone` flag set by Safari.
 * SSR-safe: returns false when `window` is not defined.
 */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  // iOS Safari sets navigator.standalone when launched from home screen
  if ((navigator as unknown as { standalone?: boolean }).standalone === true) return true
  return false
}

/**
 * Heuristic: returns true for Chromium-based desktop browsers that support
 * the `beforeinstallprompt` event (Chrome, Edge, Brave, Opera on desktop).
 * Firefox, Safari, and mobile browsers return false.
 * SSR-safe: returns false when `window` is not defined.
 */
export function supportsBeforeInstallPrompt(): boolean {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent
  // Must be Chromium-based (has "Chrome" token) but NOT on Android/iOS
  const isChromiumBased = /Chrome\//.test(ua) && !/Chromium\//.test(ua)
  const isMobileUA = /Android|iPhone|iPad|iPod/.test(ua)
  return isChromiumBased && !isMobileUA
}
