const CACHE_NAME = 'nalichat-v2';

// Never cache these — Vite dev chunks, JS modules, CSS, or API calls
const BYPASS_PATTERNS = [
  '/src/',
  '/node_modules/.vite',
  '/@vite',
  '/@react-refresh',
  '/api/',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.css',
  '.mjs',
];

function shouldBypass(url) {
  return BYPASS_PATTERNS.some(p => url.includes(p));
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Bypass: non-GET, cross-origin, or any JS/CSS/Vite/API resource
  if (
    event.request.method !== 'GET' ||
    !url.startsWith(self.location.origin) ||
    shouldBypass(url)
  ) {
    return; // Let the browser handle it normally
  }

  // For navigation requests (HTML), serve network-first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // For static assets (icons, manifest, images), cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

// Show push notifications from server-sent push events
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'NaliChat', {
      body: data.body || '',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'nali-notification',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(url));
});
