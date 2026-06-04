import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Always unregister any active service workers in dev mode to prevent
// stale Vite/React chunks from being served from cache (causes null React hooks error).
if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister());
    });
    // Also clear all caches in dev
    if ('caches' in window) {
      caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
    }
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)