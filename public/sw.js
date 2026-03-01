/* eslint-disable no-undef */
// Pendy Service Worker — Web Push + PWA offline shell

const CACHE_NAME = 'pendy-shell-v1'
// Cache the app shell (index.html) so the app opens offline
const SHELL_URLS = ['/']

// ── Install: cache the app shell ─────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  )
  // Activate immediately without waiting for old tabs to close
  self.skipWaiting()
})

// ── Activate: clean up old caches ────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
  )
  // Take control of all open clients immediately
  self.clients.claim()
})

// ── Fetch: network-first, fall back to cached shell for navigation ────────────
self.addEventListener('fetch', (event) => {
  // Only intercept same-origin GET requests
  if (event.request.method !== 'GET') return
  if (!event.request.url.startsWith(self.location.origin)) return

  // For navigation requests (loading the app), serve network then fall back to shell
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/'))
    )
    return
  }

  // For everything else: network only (Supabase API, fonts, etc.)
  // Don't cache dynamic data
})

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    data = { title: 'Pendy', body: event.data?.text() ?? '' }
  }

  const title = data.title ?? 'Pendy — Recordatorio'
  const options = {
    body: data.body ?? '',
    icon: '/pendy-logo.png',
    badge: '/pendy-logo.png',
    data: { url: data.url ?? '/app/today' },
    tag: data.tag ?? 'pendy-reminder',
    requireInteraction: false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// ── Notification click: open or focus the app ─────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url ?? '/app/today'
  const fullUrl = new URL(url, self.location.origin).href

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If the PWA is already open, focus it and navigate
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus()
            if ('navigate' in client) client.navigate(fullUrl)
            return
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) return clients.openWindow(fullUrl)
      })
  )
})
