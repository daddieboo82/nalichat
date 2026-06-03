// NaliChat Service Worker - Push Notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'NaliChat', {
      body: data.body || '',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: data.tag || 'nali-notification',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const url = event.notification.data?.url || '/';
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'navigate', url });
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
