// Preload script — runs in an isolated context before the page loads.
// Kept minimal; the app communicates with the backend via its own SDK over HTTPS.
window.addEventListener('DOMContentLoaded', () => {
  document.title = 'NaliChat';
});