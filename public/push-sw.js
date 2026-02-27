self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload = {}
  try {
    payload = event.data.json()
  } catch {
    payload = { title: '喵记提醒', body: event.data.text() }
  }

  const title = payload.title || '喵记提醒'
  const body = payload.body || '你有一条新的提醒'
  const url = payload.url || '/'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/cat-icon.svg',
      badge: '/icons/cat-icon.svg',
      data: { url },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const rawUrl = event.notification.data?.url || '/'
  // Validate URL: only allow same-origin paths to prevent open redirect
  const targetUrl = (typeof rawUrl === 'string' && rawUrl.startsWith('/')) ? rawUrl : '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      return clients.openWindow(targetUrl)
    })
  )
})
