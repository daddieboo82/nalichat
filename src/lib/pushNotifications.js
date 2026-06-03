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