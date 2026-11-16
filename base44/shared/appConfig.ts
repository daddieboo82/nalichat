// Canonical public origin for the production NaliBase application.
// Keep server-generated links and callback validation pinned to this origin so
// request headers or unregistered deployment variables cannot redirect users.
export const APP_BASE_URL = 'https://nalichat.org';
export const APP_ORIGIN = 'https://nalichat.org';

// The app's published Base44 host. Some visitors arrive here instead of the
// custom domain, and a buyer must still be able to complete a purchase. Both
// origins serve this same app, so both are trusted for checkout callbacks.
export const APP_PLATFORM_ORIGIN = 'https://nalichat.base44.app';