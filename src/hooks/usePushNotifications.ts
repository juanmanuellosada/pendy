import { useState, useEffect } from 'react'
import { pushService } from '@/services/pushService'
import { useAuth } from './useAuth'

export function usePushNotifications() {
  const { user } = useAuth()
  const supported = pushService.isSupported()
  const [permission, setPermission] = useState<NotificationPermission>(
    supported ? Notification.permission : 'denied',
  )

  // Sync subscription to DB every time the user logs in
  useEffect(() => {
    if (!user) return
    pushService.syncSubscription(user.id).catch(console.error)
  }, [user?.id])

  // Keep local permission state in sync with browser state (including external changes)
  useEffect(() => {
    if (!supported) return
    setPermission(Notification.permission)

    // Listen for permission changes made in browser settings
    navigator.permissions
      .query({ name: 'notifications' as PermissionName })
      .then((status) => {
        const handler = () => setPermission(Notification.permission)
        status.addEventListener('change', handler)
        return () => status.removeEventListener('change', handler)
      })
      .catch(() => {
        /* Permissions API not supported, ignore */
      })
  }, [supported])

  const enable = async (): Promise<boolean> => {
    if (!user) return false
    const result = await pushService.requestAndSubscribe(user.id)
    setPermission(result === 'granted' ? 'granted' : 'denied')
    return result === 'granted'
  }

  const disable = async (): Promise<void> => {
    if (!user) return
    await pushService.removeSubscription(user.id)
    setPermission('denied')
  }

  return {
    supported,
    permission,
    enabled: permission === 'granted',
    enable,
    disable,
  }
}
