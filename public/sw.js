/**
 * NaliChat Service Worker
 *
 * Strategy:
 *  - Navigation requests: network-first (always fetch fresh HTML so users
 *    get new JS/CSS chunks on every visit).
 *  - Static assets (JS/CSS/images/fonts): stale-while-revalidate (serve
 *    cached instantly, update cache from network in background).
 *  - Old caches are purged on activate.
 *
 * Update flow:
 *  The browser byte-compares /sw.js on every navigation. When a new SW is
 *  deployed it installs in the background and enters the "waiting" state.
 *  The client (usePwaUpdate hook) detects the waiting worker, shows an
 *  "Update available" banner, and on user confirmation sends
 *  { action: 'skipWaiting' } to activate the new SW immediately, then
 *  reloads the page.
 */

const CACHE_NAME = 'nalichat-v1';

// App shell — pre-cached on install so the app works offline on first load.
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
];

// ── Install ──────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(APP_SHELL).catch(() => {
        // If any individual asset fails, just skip it — the SW still installs.
      })
    )
  );
});

// ── Activate ─────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip cross-origin requests (analytics, CDNs, etc.)
  if (url.origin !== self.location.origin) return;

  // Skip API calls — always go to network.
  if (url.pathname.startsWith('/api/')) return;

  // Network-first for navigation (HTML documents).
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the fresh HTML for offline fallback.
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone));
          return response;
        })
        .catch(() =>
          caches.match('/index.html').then((r) => r || new Response('Offline', { status: 503 }))
        )
    );
    return;
  }

  // Stale-while-revalidate for static assets.
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});

// ── Message ──────────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});


function safeNotificationTarget(value) {
  try {
    const parsed = new URL(value || '/', self.location.origin);
    if (parsed.origin !== self.location.origin) return self.location.origin + '/';
    if (!['http:', 'https:'].includes(parsed.protocol)) return self.location.origin + '/';
    return parsed.href;
  } catch (_) {
    return self.location.origin + '/';
  }
}

// Open only same-origin in-app destinations when a notification is clicked.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = safeNotificationTarget(event.notification?.data?.url);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        try {
          const clientUrl = new URL(client.url);
          if (clientUrl.origin === self.location.origin) {
            client.navigate(targetUrl);
            return client.focus();
          }
        } catch (_) {
          // Ignore malformed client URLs and continue searching.
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});


// Receive background Web Push messages when the app is closed or inactive.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { body: event.data ? event.data.text() : '' };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'NaliChat', {
      body: data.body || 'You have a new notification',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: data.tag || 'nali-remote-notification',
      data: { url: data.url || '/' },
    })
  );
});
