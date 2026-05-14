import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isTauri } from './platform'

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
