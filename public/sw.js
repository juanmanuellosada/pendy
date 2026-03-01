/* eslint-disable no-undef */
// Pendy Service Worker — Web Push

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

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url ?? '/app/today'
  const fullUrl = new URL(url, self.location.origin).href

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing tab if open
        for (const client of clientList) {
          if (client.url === fullUrl && 'focus' in client) {
            return client.focus()
          }
        }
        // Open new tab
        if (clients.openWindow) return clients.openWindow(fullUrl)
      })
  )
})
