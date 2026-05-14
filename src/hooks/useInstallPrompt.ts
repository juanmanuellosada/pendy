import { useState, useEffect, useRef } from 'react'
import { detectOS, isStandalonePwa, isTauri } from '@/lib/platform'
import type { OS } from '@/lib/platform'

export const LATEST_RELEASE_URL = 'https://github.com/juanmanuellosada/pendy/releases/latest'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export interface UseInstallPromptReturn {
  canInstallPwa: boolean
  isStandalone: boolean
  isTauri: boolean
  os: OS
  latestReleaseUrl: string
  promptInstallPwa: () => Promise<'accepted' | 'dismissed' | 'unavailable'>
}

export function useInstallPrompt(): UseInstallPromptReturn {
  const [canInstallPwa, setCanInstallPwa] = useState(false)
  const [isStandalone, setIsStandalone] = useState(() => isStandalonePwa())
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null)

  const os = detectOS()
  const tauriActive = isTauri()

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      deferredPrompt.current = e as BeforeInstallPromptEvent
      setCanInstallPwa(true)
    }

    const handleAppInstalled = () => {
      deferredPrompt.current = null
      setCanInstallPwa(false)
      setIsStandalone(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const promptInstallPwa = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt.current) return 'unavailable'
    const prompt = deferredPrompt.current
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    deferredPrompt.current = null
    setCanInstallPwa(false)
    return outcome
  }

  return {
    canInstallPwa,
    isStandalone,
    isTauri: tauriActive,
    os,
    latestReleaseUrl: LATEST_RELEASE_URL,
    promptInstallPwa,
  }
}
