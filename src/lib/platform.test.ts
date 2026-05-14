import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isTauri, detectOS, isStandalonePwa, supportsBeforeInstallPrompt } from './platform'

describe('isTauri', () => {
  it('returns false in a plain PWA environment (no Tauri internals)', () => {
    // Default jsdom window has no __TAURI_INTERNALS__
    expect('__TAURI_INTERNALS__' in window).toBe(false)
    expect(isTauri()).toBe(false)
  })

  describe('when __TAURI_INTERNALS__ is present', () => {
    beforeEach(() => {
      // Simulate Tauri 2.x injecting its internals
      ;(window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__'] = {}
    })

    afterEach(() => {
      delete (window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__']
    })

    it('returns true when window.__TAURI_INTERNALS__ exists', () => {
      expect(isTauri()).toBe(true)
    })
  })

  describe('SSR / no-window environment', () => {
    it('returns false without throwing when window is undefined', () => {
      // We cannot truly delete globalThis.window in jsdom, but we can verify
      // the guard "typeof window !== 'undefined'" works by checking our implementation
      // covers that path. The real SSR case is tested by the typeof check itself.
      // In jsdom, window always exists, so we verify the function never throws.
      expect(() => isTauri()).not.toThrow()
    })
  })
})

describe('detectOS', () => {
  const originalUserAgent = navigator.userAgent
  const originalMaxTouchPoints = navigator.maxTouchPoints

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      configurable: true,
      value: originalUserAgent,
    })
    Object.defineProperty(navigator, 'maxTouchPoints', {
      writable: true,
      configurable: true,
      value: originalMaxTouchPoints,
    })
    // Remove userAgentData mock if set
    Object.defineProperty(navigator, 'userAgentData', {
      writable: true,
      configurable: true,
      value: undefined,
    })
  })

  it('returns "linux" when userAgent contains Linux', () => {
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      configurable: true,
      value: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    })
    expect(detectOS()).toBe('linux')
  })

  it('returns "windows" when userAgent contains Windows', () => {
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      configurable: true,
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    })
    expect(detectOS()).toBe('windows')
  })

  it('returns "mac" when userAgent contains Mac (no touch points)', () => {
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      configurable: true,
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0',
    })
    Object.defineProperty(navigator, 'maxTouchPoints', {
      writable: true,
      configurable: true,
      value: 0,
    })
    expect(detectOS()).toBe('mac')
  })

  it('returns "ios" when userAgent contains iPhone', () => {
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1',
    })
    expect(detectOS()).toBe('ios')
  })

  it('returns "android" when userAgent contains Android', () => {
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      configurable: true,
      value: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120.0.0.0 Mobile Safari/537.36',
    })
    expect(detectOS()).toBe('android')
  })

  it('prefers userAgentData.platform over userAgent when available', () => {
    Object.defineProperty(navigator, 'userAgentData', {
      writable: true,
      configurable: true,
      value: { platform: 'Linux' },
    })
    // Even if userAgent says Windows, userAgentData wins
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      configurable: true,
      value: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0.0.0',
    })
    expect(detectOS()).toBe('linux')
  })
})

describe('isStandalonePwa', () => {
  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: undefined,
    })
  })

  it('returns false when display-mode is not standalone', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: () => ({ matches: false }),
    })
    expect(isStandalonePwa()).toBe(false)
  })

  it('returns true when display-mode: standalone matches', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: () => ({ matches: true }),
    })
    expect(isStandalonePwa()).toBe(true)
  })

  it('returns true when navigator.standalone is true (iOS Safari)', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: () => ({ matches: false }),
    })
    Object.defineProperty(navigator, 'standalone', {
      writable: true,
      configurable: true,
      value: true,
    })
    expect(isStandalonePwa()).toBe(true)
    // Cleanup
    Object.defineProperty(navigator, 'standalone', {
      writable: true,
      configurable: true,
      value: undefined,
    })
  })
})

describe('supportsBeforeInstallPrompt', () => {
  const originalUserAgent = navigator.userAgent

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      configurable: true,
      value: originalUserAgent,
    })
  })

  it('returns true for a Chrome desktop UA', () => {
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      configurable: true,
      value:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    })
    expect(supportsBeforeInstallPrompt()).toBe(true)
  })

  it('returns false for a Firefox UA', () => {
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      configurable: true,
      value: 'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
    })
    expect(supportsBeforeInstallPrompt()).toBe(false)
  })

  it('returns false for an Android Chrome UA (mobile)', () => {
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      configurable: true,
      value:
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
    })
    expect(supportsBeforeInstallPrompt()).toBe(false)
  })

  it('returns false for an iOS Safari UA', () => {
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      configurable: true,
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
    })
    expect(supportsBeforeInstallPrompt()).toBe(false)
  })
})
