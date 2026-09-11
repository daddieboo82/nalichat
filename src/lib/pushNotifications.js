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

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export async function subscribeToRemotePush() {
  if (!isPushSupported() || Notification.permission !== 'granted') {
    return { subscribed: false, reason: 'permission' };
  }

  const reg = await registerServiceWorker();
  if (!reg?.pushManager) {
    return { subscribed: false, reason: 'unsupported' };
  }

  const { base44 } = await import('@/api/base44Client');
  const configResponse = await base44.functions.invoke('getPushConfig', {});
  const config = configResponse?.data ?? configResponse;
  if (!config?.configured || !config?.publicKey) {
    return { subscribed: false, reason: 'not_configured' };
  }

  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.publicKey),
    });
  }

  const json = subscription.toJSON();
  await base44.functions.invoke('registerPushSubscription', {
    endpoint: json.endpoint,
    keys: json.keys,
    userAgent: navigator.userAgent,
  });

  return { subscribed: true };
}


export async function unsubscribeFromRemotePush() {
  if (!isPushSupported()) return { unsubscribed: false, reason: 'unsupported' };

  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    const subscription = await reg?.pushManager?.getSubscription();
    if (!subscription) return { unsubscribed: false, reason: 'not_subscribed' };

    const endpoint = subscription.endpoint;
    try {
      const { base44 } = await import('@/api/base44Client');
      await base44.functions.invoke('unregisterPushSubscription', { endpoint });
    } catch (error) {
      console.warn('Could not unregister push subscription on server:', error);
    }

    await subscription.unsubscribe();
    return { unsubscribed: true };
  } catch (error) {
    console.warn('Could not unsubscribe from push:', error);
    return { unsubscribed: false, reason: 'error' };
  }
}
