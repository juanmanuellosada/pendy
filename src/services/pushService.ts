import { supabase } from '@/lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return new Uint8Array([...rawData].map((char) => char.charCodeAt(0)))
}

export const pushService = {
  isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  },

  async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!this.isSupported()) return null
    try {
      return await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
    } catch {
      return null
    }
  },

  async getExistingSubscription(): Promise<PushSubscription | null> {
    const registration = await navigator.serviceWorker.ready
    return registration.pushManager.getSubscription()
  },

  async subscribe(): Promise<PushSubscription | null> {
    const registration = await navigator.serviceWorker.ready
    return registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
    })
  },

  async saveSubscription(userId: string, subscription: PushSubscription): Promise<void> {
    const json = subscription.toJSON() as {
      endpoint: string
      keys: { p256dh: string; auth: string }
    }
    await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
      { onConflict: 'user_id,endpoint' }
    )
  },

  async removeSubscription(userId: string): Promise<void> {
    const sub = await this.getExistingSubscription()
    if (sub) {
      await sub.unsubscribe()
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', sub.endpoint)
    }
  },

  async requestAndSubscribe(userId: string): Promise<'granted' | 'denied' | 'unsupported'> {
    if (!this.isSupported()) return 'unsupported'

    await this.registerServiceWorker()

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return 'denied'

    const subscription = await this.subscribe()
    if (!subscription) return 'denied'

    await this.saveSubscription(userId, subscription)
    return 'granted'
  },

  /** Re-save an existing subscription (called on login to keep DB in sync).
   *  If permission is granted but no active subscription exists (e.g. after SW was
   *  destroyed), silently re-subscribes so reminders can be delivered. */
  async syncSubscription(userId: string): Promise<void> {
    if (!this.isSupported() || Notification.permission !== 'granted') return
    await this.registerServiceWorker()
    let sub = await this.getExistingSubscription()
    if (!sub) {
      try {
        sub = await this.subscribe()
      } catch {
        return
      }
    }
    if (sub) await this.saveSubscription(userId, sub)
  },
}
