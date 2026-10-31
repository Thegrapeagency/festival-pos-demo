// Service worker van de cockpit: alleen voor pushmeldingen (hulpvragen van kassa's). Geen caching, zodat een
// nieuwe versie van de cockpit altijd meteen geladen wordt.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (e) => {
  let d = { title: 'Hulpvraag', body: '', url: './?tab=help' }
  try { d = { ...d, ...e.data.json() } } catch { /* platte tekst */ }
  e.waitUntil(self.registration.showNotification(d.title, {
    body: d.body,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: 'hulp-' + Date.now(),
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: { url: d.url },
  }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = new URL(e.notification.data?.url || './?tab=help', self.registration.scope).href
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of all) {
      if (c.url.startsWith(self.registration.scope)) {
        await c.focus()
        c.postMessage({ type: 'open-tab', tab: 'help' })
        return
      }
    }
    await self.clients.openWindow(url)
  })())
})
