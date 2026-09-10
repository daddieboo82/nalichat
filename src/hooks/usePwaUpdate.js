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

    const handleUpdateFound = () => {
      const installing = registration.installing;
      if (!installing) return;

      installing.addEventListener('statechange', () => {
        // A new SW has installed and is waiting — but only show the prompt
        // if there's already an active SW controlling the page (i.e. this is
        // an update, not a first-time install).
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          setWaitingWorker(installing);
          setUpdateAvailable(true);
        }
      });
    };

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        registration = reg;

        // If a SW is already waiting (e.g. user dismissed the prompt last
        // visit and reloaded), show the update immediately.
        if (reg.waiting && navigator.serviceWorker.controller) {
          setWaitingWorker(reg.waiting);
          setUpdateAvailable(true);
        }

        reg.addEventListener('updatefound', handleUpdateFound);

        // Periodically check for SW updates (every 60 minutes).
        updateInterval = setInterval(() => {
          reg.update().catch(() => {});
        }, 60 * 60 * 1000);
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
      if (registration) {
        registration.removeEventListener('updatefound', handleUpdateFound);
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