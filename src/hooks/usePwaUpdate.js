import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Detects when a new version of the service worker is waiting to activate
 * and provides a way to apply the update immediately.
 *
 * In dev / preview / sandbox / native (Capacitor) environments the hook is
 * a no-op — service workers are only active in production PWA mode.
 */
export function usePwaUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState(null);
  const updateAppliedRef = useRef(false);
  const reloadedRef = useRef(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Skip in dev / preview / sandbox — SW is unregistered there.
    const isDev =
      import.meta.env.DEV ||
      window.location.hostname.includes('preview') ||
      window.location.hostname.includes('sandbox') ||
      window.location.hostname.includes('localhost');

    // Skip in Capacitor native apps — updates come through the Play Store.
    const isNative = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNative;

    if (isDev || isNative) return;

    let registration;
    let updateInterval;
    let disposed = false;
    let installingWorker = null;
    let installingStateHandler = null;

    const handleUpdateFound = () => {
      if (disposed) return;
      const installing = registration?.installing;
      if (!installing) return;

      if (installingWorker && installingStateHandler) {
        installingWorker.removeEventListener('statechange', installingStateHandler);
      }

      installingWorker = installing;
      installingStateHandler = () => {
        if (disposed) return;
        // A new SW has installed and is waiting — but only show the prompt
        // if there's already an active SW controlling the page (i.e. this is
        // an update, not a first-time install).
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          setWaitingWorker(installing);
          setUpdateAvailable(true);
        }
      };
      installing.addEventListener('statechange', installingStateHandler);
    };

    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        if (disposed) return;
        registration = reg;

        // If a SW is already waiting (e.g. user dismissed the prompt last
        // visit and reloaded), show the update immediately.
        if (reg.waiting && navigator.serviceWorker.controller) {
          setWaitingWorker(reg.waiting);
          setUpdateAvailable(true);
        }

        reg.addEventListener('updatefound', handleUpdateFound);

        const checkForUpdate = () => {
          if (document.visibilityState === 'visible') {
            reg.update().catch(() => {});
          }
        };

        // iPhone/PWA installs can remain open for long periods. Re-check when
        // Safari resumes the app instead of waiting up to an hour.
        document.addEventListener('visibilitychange', checkForUpdate);
        window.addEventListener('pageshow', checkForUpdate);
        checkForUpdate();

        // Keep a periodic fallback as well.
        updateInterval = setInterval(checkForUpdate, 15 * 60 * 1000);

        registration._naliCheckForUpdate = checkForUpdate;
      })
      .catch(() => {});

    // When a new SW takes control *because the user applied an update*, reload
    // to get fresh content. The first-ever install also fires controllerchange
    // (sw.js calls clients.claim() on activate), and reloading there threw
    // first-time visitors out of whatever they were doing, so it is ignored.
    const handleControllerChange = () => {
      if (!updateAppliedRef.current) return;
      if (reloadedRef.current) return;
      reloadedRef.current = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      disposed = true;
      if (registration) {
        registration.removeEventListener('updatefound', handleUpdateFound);
      }
      if (installingWorker && installingStateHandler) {
        installingWorker.removeEventListener('statechange', installingStateHandler);
      }
      if (registration?._naliCheckForUpdate) {
        document.removeEventListener('visibilitychange', registration._naliCheckForUpdate);
        window.removeEventListener('pageshow', registration._naliCheckForUpdate);
      }
      if (updateInterval) clearInterval(updateInterval);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (waitingWorker) {
      updateAppliedRef.current = true;
      waitingWorker.postMessage({ action: 'skipWaiting' });
    }
  }, [waitingWorker]);

  return { updateAvailable, applyUpdate };
}