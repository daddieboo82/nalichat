import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { sounds } from '@/hooks/use-sound'

// Global audio feedback — plays a subtle click on every button & interactive control.
// Delegated listener (single handler) so it works app-wide without per-component wiring.
if (typeof document !== "undefined") {
  document.addEventListener("click", (e) => {
    const target = e.target.closest("button, [role='button'], a[href]");
    if (target && !target.dataset.noSound) sounds.click();
  }, true);
}

// Unregister stale service workers in dev/preview/sandbox to prevent
// cached stale Vite/React chunks causing "Cannot read properties of null (reading 'useState')" errors.
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  const isUnsafeEnv = import.meta.env.DEV ||
    window.location.hostname.includes('preview') ||
    window.location.hostname.includes('sandbox') ||
    window.location.hostname.includes('localhost');

  if (isUnsafeEnv) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister());
    });
    if ('caches' in window) {
      caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
    }
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)