import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, serverUrl, appBaseUrl } = appParams;

//Create a client with authentication required
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl,
  requiresAuth: false,
  appBaseUrl
});

// ── auth.me() request de-duplication ──────────────────────────────────────
// Around 30 components call base44.auth.me() from their own mount effect, so a
// single page load fired a burst of identical /me requests (nav bars, presence
// provider, notification bell, the page itself…). Concurrent calls now share
// one in-flight promise. This is purely a de-dupe: once the request settles the
// next call hits the network again, so a me() issued after a profile update
// still returns fresh data.
if (base44?.auth?.me) {
  const originalMe = base44.auth.me.bind(base44.auth);
  let inFlight = null;
  base44.auth.me = (...args) => {
    // Only de-dupe the plain, argument-less call used across the app.
    if (args.length > 0) return originalMe(...args);
    if (inFlight) return inFlight;
    inFlight = originalMe().finally(() => { inFlight = null; });
    return inFlight;
  };
}
