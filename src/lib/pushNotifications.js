// Push notification helpers using the browser's Notification API (no VAPID server needed)

export function isPushSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

export function getPermissionStatus() {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

export async function requestPushPermission() {
  if (!isPushSupported()) return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;

  // Unregister stale SWs in dev mode OR in preview/sandbox environments
  // to prevent cache-serving stale Vite/React chunks (causes null React hook errors).
  const isPreview = window.location.hostname.includes('preview') ||
    window.location.hostname.includes('sandbox') ||
    window.location.hostname.includes('localhost');

  if (import.meta.env.DEV || isPreview) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      await reg.unregister();
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    return reg;
  } catch {
    return null;
  }
}

/**
 * Show a browser push notification directly (no push server required).
 * Falls back gracefully if permission is not granted.
 */
export async function showPushNotification({ title, body, url = '/' }) {
  if (!isPushSupported() || Notification.permission !== 'granted') return;

  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  if (reg) {
    reg.showNotification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'nali-notification',
      data: { url },
    });
  } else {
    // Fallback: direct Notification API
    new Notification(title, { body, icon: '/favicon.ico' });
  }
}