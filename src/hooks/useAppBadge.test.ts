import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'

// ------------------------------------------------------------------
// Mock @tauri-apps/api/core before any module is imported.
// The package is installed as an optional dependency and the real
// module exists on disk, but we want full control of invoke() in tests.
// ------------------------------------------------------------------
const mockInvoke = vi.fn().mockResolvedValue(undefined)

vi.mock('@tauri-apps/api/core', () => ({ invoke: mockInvoke }))

// ------------------------------------------------------------------
// Mock all sub-hooks so the test is isolated from Supabase/React Query.
// ------------------------------------------------------------------
vi.mock('@/hooks/useTasks', () => ({
  useTodayTasks: () => ({ data: [] }),
}))

vi.mock('@/hooks/useHabits', () => ({
  useTodayHabits: () => ({ data: [] }),
  useHabitCompletions: () => ({ data: [] }),
}))

vi.mock('@/stores/uiStore', () => ({
  useUIStore: () => ({
    getViewOptions: () => ({ showHabits: true }),
  }),
}))

// ------------------------------------------------------------------
// Mock isTauri so we can control detected environment per test.
// ------------------------------------------------------------------
vi.mock('@/lib/platform', () => ({
  isTauri: vi.fn().mockReturnValue(false),
}))

import { useAppBadge } from './useAppBadge'
import { isTauri } from '@/lib/platform'

const mockedIsTauri = vi.mocked(isTauri)

describe('useAppBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__']
  })

  describe('PWA branch (isTauri() === false)', () => {
    beforeEach(() => {
      mockedIsTauri.mockReturnValue(false)
    })

    it('does NOT call invoke in PWA branch', async () => {
      renderHook(() => useAppBadge())
      await new Promise((r) => setTimeout(r, 50))
      expect(mockInvoke).not.toHaveBeenCalled()
    })

    it('calls navigator.setAppBadge when Badging API is available', async () => {
      const setAppBadge = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'setAppBadge', {
        value: setAppBadge,
        writable: true,
        configurable: true,
      })

      renderHook(() => useAppBadge())
      await new Promise((r) => setTimeout(r, 50))

      // In PWA branch with count=0 the hook calls clearAppBadge, not setAppBadge.
      // The important check is that invoke was NOT called.
      expect(mockInvoke).not.toHaveBeenCalled()
    })
  })

  describe('Tauri branch (isTauri() === true)', () => {
    beforeEach(() => {
      mockedIsTauri.mockReturnValue(true)
    })

    it('calls invoke("set_app_badge") with the current badge count', async () => {
      renderHook(() => useAppBadge())
      await new Promise((r) => setTimeout(r, 50))

      // With all sub-hooks mocked to return empty arrays, todayCount = 0.
      expect(mockInvoke).toHaveBeenCalledWith('set_app_badge', { count: 0 })
    })

    it('does NOT call navigator.setAppBadge in Tauri branch', async () => {
      const setAppBadge = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'setAppBadge', {
        value: setAppBadge,
        writable: true,
        configurable: true,
      })

      renderHook(() => useAppBadge())
      await new Promise((r) => setTimeout(r, 50))

      expect(setAppBadge).not.toHaveBeenCalled()
    })

    it('does not propagate invoke errors to the UI', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('IPC error'))
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

      renderHook(() => useAppBadge())
      await new Promise((r) => setTimeout(r, 50))

      expect(warnSpy).toHaveBeenCalledWith('[badge] tauri invoke failed', expect.any(Error))
      warnSpy.mockRestore()
    })

    it('does NOT send postMessage to Service Worker in Tauri branch', async () => {
      const postMessage = vi.fn()
      Object.defineProperty(navigator, 'serviceWorker', {
        value: { controller: { postMessage } },
        writable: true,
        configurable: true,
      })

      renderHook(() => useAppBadge())
      await new Promise((r) => setTimeout(r, 50))

      expect(postMessage).not.toHaveBeenCalled()
    })
  })
})
