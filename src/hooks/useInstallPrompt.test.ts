import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ------------------------------------------------------------------
// Mock platform helpers so each test can control them.
// ------------------------------------------------------------------
vi.mock('@/lib/platform', () => ({
  isTauri: vi.fn().mockReturnValue(false),
  detectOS: vi.fn().mockReturnValue('linux'),
  isStandalonePwa: vi.fn().mockReturnValue(false),
  supportsBeforeInstallPrompt: vi.fn().mockReturnValue(true),
}))

import { useInstallPrompt } from './useInstallPrompt'
import { isTauri, detectOS, isStandalonePwa } from '@/lib/platform'

const mockedIsTauri = vi.mocked(isTauri)
const mockedDetectOS = vi.mocked(detectOS)
const mockedIsStandalonePwa = vi.mocked(isStandalonePwa)

describe('useInstallPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedIsTauri.mockReturnValue(false)
    mockedDetectOS.mockReturnValue('linux')
    mockedIsStandalonePwa.mockReturnValue(false)
  })

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__']
  })

  // 1. Browser Chromium desktop with PWA not installed → canInstallPwa === true after event
  it('sets canInstallPwa to true when beforeinstallprompt fires', async () => {
    mockedDetectOS.mockReturnValue('linux')
    mockedIsStandalonePwa.mockReturnValue(false)

    const { result } = renderHook(() => useInstallPrompt())

    expect(result.current.canInstallPwa).toBe(false)

    await act(async () => {
      window.dispatchEvent(new Event('beforeinstallprompt'))
    })

    expect(result.current.canInstallPwa).toBe(true)
  })

  // 2. PWA standalone (display-mode standalone) → isStandalone === true, canInstallPwa === false
  it('reports isStandalone when isStandalonePwa returns true', () => {
    mockedIsStandalonePwa.mockReturnValue(true)

    const { result } = renderHook(() => useInstallPrompt())

    expect(result.current.isStandalone).toBe(true)
    expect(result.current.canInstallPwa).toBe(false)
  })

  // 3. Tauri (window.__TAURI_INTERNALS__ present) → isTauri === true
  it('reports isTauri true when running inside Tauri', () => {
    mockedIsTauri.mockReturnValue(true)

    const { result } = renderHook(() => useInstallPrompt())

    expect(result.current.isTauri).toBe(true)
  })

  // 4. Firefox simulated (no beforeinstallprompt) → canInstallPwa === false
  it('keeps canInstallPwa false when beforeinstallprompt never fires (Firefox)', () => {
    const { result } = renderHook(() => useInstallPrompt())

    expect(result.current.canInstallPwa).toBe(false)
  })

  // 5. iOS simulated → os === 'ios'
  it('returns os === "ios" when detectOS returns ios', () => {
    mockedDetectOS.mockReturnValue('ios')

    const { result } = renderHook(() => useInstallPrompt())

    expect(result.current.os).toBe('ios')
  })

  // 6. Linux detection → os === 'linux'
  it('returns os === "linux" when detectOS returns linux', () => {
    mockedDetectOS.mockReturnValue('linux')

    const { result } = renderHook(() => useInstallPrompt())

    expect(result.current.os).toBe('linux')
  })

  // 7. Call to promptInstallPwa() without deferred event → 'unavailable'
  it('returns "unavailable" from promptInstallPwa when no deferred prompt exists', async () => {
    const { result } = renderHook(() => useInstallPrompt())

    let outcome: string | undefined
    await act(async () => {
      outcome = await result.current.promptInstallPwa()
    })

    expect(outcome).toBe('unavailable')
  })

  // Bonus: appinstalled event clears canInstallPwa and sets isStandalone
  it('sets isStandalone and clears canInstallPwa when appinstalled fires', async () => {
    const { result } = renderHook(() => useInstallPrompt())

    await act(async () => {
      window.dispatchEvent(new Event('beforeinstallprompt'))
    })
    expect(result.current.canInstallPwa).toBe(true)

    await act(async () => {
      window.dispatchEvent(new Event('appinstalled'))
    })

    expect(result.current.canInstallPwa).toBe(false)
    expect(result.current.isStandalone).toBe(true)
  })

  // Bonus: latestReleaseUrl is exposed
  it('exposes the latest release URL', () => {
    const { result } = renderHook(() => useInstallPrompt())

    expect(result.current.latestReleaseUrl).toBe(
      'https://github.com/juanmanuellosada/pendy/releases/latest',
    )
  })
})
