import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import { usePerformance } from '@/hooks/use-performance';
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference';
import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLoader from '@/components/layout/AppLoader';
import NavRipple from '@/components/layout/NavRipple';
import ErrorBoundary from '@/components/ErrorBoundary';
import { AudioPlayerProvider } from '@/lib/AudioPlayerContext';
import { NaliPresenceProvider } from '@/lib/NaliPresenceContext';
import { LockedChatsProvider } from '@/lib/LockedChatsContext';
import { initProductAnalytics } from '@/lib/productAnalytics';
import { getMarketingAttribution } from '@/lib/adAttribution';
import { trackPaywallEvent } from '@/lib/paywallAnalytics';
import { base44 } from '@/api/base44Client';

import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

import AppLayout from '@/components/layout/AppLayout';
import Home from '@/pages/Home';
import AskNaliHint from '@/components/AskNaliHint';
import PwaUpdatePrompt from '@/components/PwaUpdatePrompt';

function lazyWithReloadRecovery(importer, key) {
  return lazy(async () => {
    const retryKey = `nali:lazy-retry:${key}`;
    try {
      const module = await importer();
      try { sessionStorage.removeItem(retryKey); } catch {}
      return module;
    } catch (error) {
      const message = String(error?.message || error || '');
      const isDynamicImportFailure = /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed/i.test(message);
      let alreadyRetried = false;
      try { alreadyRetried = sessionStorage.getItem(retryKey) === '1'; } catch {}

      if (isDynamicImportFailure && !alreadyRetried && typeof window !== 'undefined') {
        try { sessionStorage.setItem(retryKey, '1'); } catch {}
        window.location.reload();
        return new Promise(() => {});
      }
      throw error;
    }
  });
}

// The assistant pulls in the whole react-markdown/unified stack, which added
// ~150 kB to the entry chunk even though the panel only renders once the user
// opens it. Load it after first paint instead.
const AiAssistant = lazyWithReloadRecovery(() => import('@/components/AiAssistant'), 'ai-assistant');

// Lazily-loaded routes — each downloads on demand so initial load & tab-switching are fastest.
const Messages = lazyWithReloadRecovery(() => import('@/pages/Messages'), 'messages');
const Files = lazyWithReloadRecovery(() => import('@/pages/Files'), 'files');
const Settings = lazyWithReloadRecovery(() => import('@/pages/Settings'), 'settings');
const Explore = lazyWithReloadRecovery(() => import('@/pages/Explore'), 'explore');
const Leaderboard = lazyWithReloadRecovery(() => import('@/pages/Leaderboard'), 'leaderboard');
const Profile = lazyWithReloadRecovery(() => import('@/pages/Profile'), 'profile');
const Playlists = lazyWithReloadRecovery(() => import('@/pages/Playlists'), 'playlists');
const PlaylistDetail = lazyWithReloadRecovery(() => import('@/pages/PlaylistDetail'), 'playlist-detail');
const Analytics = lazyWithReloadRecovery(() => import('@/pages/Analytics'), 'analytics');
const ThankYou = lazyWithReloadRecovery(() => import('@/pages/ThankYou'), 'thank-you');
const Onboarding = lazyWithReloadRecovery(() => import('@/pages/Onboarding'), 'onboarding');
const PricingPlans = lazyWithReloadRecovery(() => import('@/components/pricing/PricingPlans'), 'pricing');
const Privacy = lazyWithReloadRecovery(() => import('@/pages/Privacy'), 'privacy');
const MusicCollaborationLanding = lazyWithReloadRecovery(() => import('@/pages/MusicCollaborationLanding'), 'music-collaboration');
const CreatorMessagingLanding = lazyWithReloadRecovery(() => import('@/pages/CreatorMessagingLanding'), 'creator-messaging');
const MusicStudioLanding = lazyWithReloadRecovery(() => import('@/pages/MusicStudioLanding'), 'music-studio');
const Terms = lazyWithReloadRecovery(() => import('@/pages/Terms'), 'terms');
const EncryptionDocumentation = lazyWithReloadRecovery(() => import('@/pages/EncryptionDocumentation'), 'encryption-documentation');
const Studio = lazyWithReloadRecovery(() => import('@/pages/Studio'), 'studio');
const AdminDashboard = lazyWithReloadRecovery(() => import('@/pages/AdminDashboard'), 'admin-dashboard');
const Record = lazyWithReloadRecovery(() => import('@/pages/Record'), 'record');
const CoverArt = lazyWithReloadRecovery(() => import('@/pages/CoverArt'), 'cover-art');
const WorldHub = lazyWithReloadRecovery(() => import('@/pages/WorldHub'), 'world-hub');
const WebhookTest = lazyWithReloadRecovery(() => import('@/pages/WebhookTest'), 'webhook-test');
const ProjectsSummary = lazyWithReloadRecovery(() => import('@/pages/ProjectsSummary'), 'projects-summary');
const ChallengeHub = lazyWithReloadRecovery(() => import('@/pages/ChallengeHub'), 'challenge-hub');
const CreateChallenge = lazyWithReloadRecovery(() => import('@/pages/CreateChallenge'), 'create-challenge');
const ChallengeDetail = lazyWithReloadRecovery(() => import('@/pages/ChallengeDetail'), 'challenge-detail');
const ChallengeLeaderboard = lazyWithReloadRecovery(() => import('@/pages/ChallengeLeaderboard'), 'challenge-leaderboard');
const SubmissionPlayer = lazyWithReloadRecovery(() => import('@/pages/SubmissionPlayer'), 'submission-player');
const Squad = lazyWithReloadRecovery(() => import('@/pages/Squad'), 'squad');
const SquadJoin = lazyWithReloadRecovery(() => import('@/pages/SquadJoin'), 'squad-join');
const ViralSeed = lazyWithReloadRecovery(() => import('@/pages/ViralSeed'), 'viral-seed');
const OAuthConsent = lazyWithReloadRecovery(() => import('@/pages/OAuthConsent'), 'oauth-consent');
const SharedFileDownload = lazyWithReloadRecovery(() => import('@/pages/SharedFileDownload'), 'shared-file-download');
const LiveTV = lazyWithReloadRecovery(() => import('@/pages/LiveTV'), 'live-tv');
const LiveBattles = lazyWithReloadRecovery(() => import('@/pages/LiveBattles'), 'live-battles');
const MusicVideoGenerator = lazyWithReloadRecovery(() => import('@/pages/MusicVideoGenerator'), 'music-video-generator');
const ArtistCareerOS = lazyWithReloadRecovery(() => import('@/pages/ArtistCareerOS'), 'artist-career-os');
const ArtistReleaseCenter = lazyWithReloadRecovery(() => import('@/pages/ArtistReleaseCenter'), 'artist-release-center');

function safeLocalStorageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function safeLocalStorageSet(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isInitialMount = useRef(true);

  const { user } = useAuth();

  useEffect(() => {
    isInitialMount.current = false;
  }, []);

  // First-party product analytics: SPA page views plus active/engaged session time.
  // This lets us distinguish a true 28-second visit from analytics undercounting.
  useEffect(() => initProductAnalytics(user?.id || null), [user?.id]);

  // Presence is app-wide, not Messages-only. A user actively working in Studio,
  // Files, Explore, etc. should still appear online to their chat partners.
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return undefined;

    const sendPresence = (isOnline) => {
      if (typeof base44?.functions?.invoke !== 'function') return;
      base44.functions.invoke('updateUserPresence', { isOnline })
        .then((res) => {
          if (
            res?.data?.error ||
            res?.data?.success !== true ||
            res?.data?.action !== 'update_presence' ||
            res?.data?.userId !== user.id ||
            res?.data?.isOnline !== isOnline
          ) {
            throw new Error(res?.data?.error || 'Presence update was not confirmed.');
          }
        })
        .catch((error) => {
          console.warn('Presence update failed:', error);
        });
    };
    const syncVisibility = () => sendPresence(document.visibilityState === 'visible');
    const handlePageHide = () => sendPresence(false);
    const handlePageShow = () => syncVisibility();

    document.addEventListener('visibilitychange', syncVisibility);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);
    syncVisibility();
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === 'visible') sendPresence(true);
    }, 60_000);

    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', syncVisibility);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
      sendPresence(false);
    };
  }, [isAuthenticated, user?.id]);

  // Fire Google Ads SIGNUP conversion once per freshly-created user.
  useEffect(() => {
    if (typeof window === 'undefined' || !user || !user.id) return;
    const createdDate = String(user.created_date || '');
    const createdDateUtc = /(?:Z|[+-]\d{2}:?\d{2})$/.test(createdDate)
        ? createdDate
        : createdDate + 'Z';
    const createdAtMs = Date.parse(createdDateUtc);
    const isNewSignup = Number.isFinite(createdAtMs) &&
        Date.now() - createdAtMs < 24 * 60 * 60 * 1000;
    const key = '_aw_signup_fired_AW-18416125487/twIWCJHa5OkcEK-Mv81E_' + user.id;
    if (!isNewSignup || safeLocalStorageGet(key)) return;
    let tries = 0;
    const fire = () => {
        if (!window.gtag) { if (tries++ < 20) setTimeout(fire, 250); return; }
        if (safeLocalStorageGet(key)) return;
        safeLocalStorageSet(key, '1');
        const attribution = getMarketingAttribution();
        window.gtag('event', 'conversion', {
            send_to: 'AW-18416125487/twIWCJHa5OkcEK-Mv81E',
            transaction_id: user.id,
        });
        // Also emit a first-party signup event with non-PII campaign context so
        // GTM/analytics can evaluate which ads and keywords drive registrations.
        window.gtag('event', 'sign_up', {
            method: 'nalichat',
            campaign_source: attribution?.utm_source || undefined,
            campaign_medium: attribution?.utm_medium || undefined,
            campaign_name: attribution?.utm_campaign || undefined,
            campaign_term: attribution?.utm_term || undefined,
            campaign_content: attribution?.utm_content || undefined,
            campaign_landing_path: attribution?.landing_path || undefined,
            google_ads_click: Boolean(attribution?.gclid || attribution?.gbraid || attribution?.wbraid),
        });
        let pendingMethod = null;
        try {
            pendingMethod = sessionStorage.getItem('registration_pending_method');
            sessionStorage.removeItem('registration_pending_method');
        } catch {}
        if (pendingMethod === 'google') {
            trackPaywallEvent('registration_completed', {
                source: 'google_oauth',
                campaign_source: attribution?.utm_source || undefined,
                campaign_medium: attribution?.utm_medium || undefined,
                campaign_name: attribution?.utm_campaign || undefined,
                campaign_term: attribution?.utm_term || undefined,
                campaign_content: attribution?.utm_content || undefined,
                campaign_landing_path: attribution?.landing_path || undefined,
                google_ads_click: Boolean(attribution?.gclid || attribution?.gbraid || attribution?.wbraid),
            });
        }
    };
    fire();
  }, [user]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const lastActive = safeLocalStorageGet('last_activity');
    const parsedLastActive = lastActive ? Number.parseInt(lastActive, 10) : NaN;
    if (
      Number.isFinite(parsedLastActive)
      && Date.now() - parsedLastActive > 24 * 60 * 60 * 1000
    ) {
      logout();
      return;
    }

    const updateActivity = () => safeLocalStorageSet('last_activity', Date.now().toString());
    // Initialize activity only when there is no valid prior timestamp. Existing
    // timestamps must survive reloads so the 24-hour inactivity policy works.
    if (!Number.isFinite(parsedLastActive)) updateActivity();

    window.addEventListener('mousemove', updateActivity, { passive: true });
    window.addEventListener('keydown', updateActivity, { passive: true });
    window.addEventListener('touchstart', updateActivity, { passive: true });
    window.addEventListener('play', updateActivity, { passive: true, capture: true });
    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('touchstart', updateActivity);
      window.removeEventListener('play', updateActivity, true);
    };
  }, [isAuthenticated, logout]);

  // Public routes must not be blocked by the remote auth/public-settings probe.
  // A slow or unavailable auth endpoint should never hide login, registration,
  // password recovery, shared-file downloads, or the production 404 page.
  const PUBLIC_PATHS = new Set([
    '/login', '/register', '/forgot-password', '/reset-password', '/oauth-consent',
    '/shared-file', '/privacy', '/terms', '/encryption-documentation',
    '/music-collaboration', '/creator-messaging', '/music-studio', '/pricing',
    '/pricingplans', '/thankyou', '/subscription_thank_you',
  ]);
  const routePath = location.pathname.toLowerCase();
  const isKnownPublicPath = PUBLIC_PATHS.has(routePath);
  const isUnknownPath = ![
    '/', '/explore', '/challenges', '/onboarding', '/studio', '/messages', '/files',
    '/settings', '/record', '/leaderboard', '/profile', '/playlists', '/analytics',
    '/cover-art', '/webhook-test', '/projects-summary', '/create-challenge', '/squad',
    '/admin', '/business', '/viral-seed',
  ].some((path) => routePath === path || routePath.startsWith(`${path}/`))
    && !isKnownPublicPath;

  // ProtectedRoute owns the auth-loading state for protected pages. Public
  // settings are non-blocking so public routes and anonymous redirects render
  // even when the remote settings probe is slow.

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // App-level auth required (Private App)
      // Redirect to platform login
      window.location.href = '/api/auth/login?next=' + encodeURIComponent(window.location.href);
      return null;
    }
  }

  // Admins bypass onboarding gate entirely.
  const isAdminUser = user?.role === 'admin';

  // Routes that must stay reachable mid-onboarding: legal pages a user is asked to
  // agree to, the password-reset flow, and the auth screens themselves. Without
  // these, an authenticated user who hasn't finished onboarding is bounced away
  // from Terms/Privacy and cannot complete a password reset.
  const ONBOARDING_EXEMPT_PATHS = new Set([
    '/onboarding', '/login', '/register', '/forgot-password', '/reset-password',
    '/privacy', '/terms', '/thankyou', '/subscription_thank_you', '/oauth-consent', '/shared-file',
  ]);
  const currentPath = location.pathname.toLowerCase();

  if (
    isAuthenticated &&
    user &&
    !user.onboarding_completed &&
    !isAdminUser &&
    !ONBOARDING_EXEMPT_PATHS.has(currentPath)
  ) {
    return <Navigate to="/onboarding" replace />;
  }

  // Core app routes require authentication, while individual paid capabilities
  // use explicit entitlement gates.

  return (
    <>
      <span
        data-testid="auth-state"
        data-state={isAuthenticated ? "authenticated" : "anonymous"}
        data-user-id={user?.id || ""}
        className="sr-only"
        aria-hidden="true"
      />
      <Suspense fallback={
        <div className="fixed inset-0 flex items-center justify-center bg-background">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      }>
      <Routes location={location}>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/music-collaboration" element={<MusicCollaborationLanding />} />
      <Route path="/creator-messaging" element={<CreatorMessagingLanding />} />
      <Route path="/music-studio" element={<MusicStudioLanding />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/oauth-consent" element={<OAuthConsent />} />
      <Route path="/shared-file" element={<SharedFileDownload />} />
      <Route path="/onboarding" element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />}><Onboarding /></ProtectedRoute>} />
      <Route path="/Onboarding" element={<Navigate to="/onboarding" replace />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/pricing" element={<PricingPlans />} />
        <Route path="/PricingPlans" element={<PricingPlans />} />
        <Route path="/challenges" element={<ChallengeHub />} />
        <Route path="/challenge/:challengeId" element={<ChallengeDetail />} />
        <Route path="/challenge/:challengeId/leaderboard" element={<ChallengeLeaderboard />} />
        <Route path="/challenge/:challengeId/submission/:submissionId" element={<SubmissionPlayer />} />
        <Route path="/squad/join/:inviteCode" element={<SquadJoin />} />
      <Route path="/viral-seed" element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login?returnTo=%2Fviral-seed" replace />}><ViralSeed /></ProtectedRoute>} />
        <Route path="/ThankYou" element={<ThankYou />} />
        <Route path="/thankyou" element={<ThankYou />} />
        <Route path="/subscription_thank_you" element={<ThankYou />} />
      </Route>
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`} replace />} />}>
        <Route path="/studio" element={<Studio />} />
        <Route element={<AppLayout />}>
          <Route path="/world/:worldId" element={<WorldHub />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/live-tv" element={<LiveTV />} />
          <Route path="/battles" element={<LiveBattles />} />
          <Route path="/music-video-generator" element={<MusicVideoGenerator />} />
          <Route path="/artist-career-os" element={<ArtistCareerOS />} />
          <Route path="/artist-release-center" element={<ArtistReleaseCenter />} />
          <Route path="/files" element={<Files />} />

          <Route path="/settings" element={<Settings />} />
          <Route path="/record" element={<Record />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/playlists" element={<Playlists />} />
          <Route path="/playlist/:playlistId" element={<PlaylistDetail />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/cover-art" element={<CoverArt />} />
          <Route path="/webhook-test" element={<WebhookTest />} />
          <Route path="/WebhookTest" element={<Navigate to="/webhook-test" replace />} />
          <Route path="/projects-summary" element={<ProjectsSummary />} />
          <Route path="/create-challenge" element={<CreateChallenge />} />
          <Route path="/squad" element={<Squad />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/business" element={<Navigate to="/admin" replace />} />
        </Route>
      </Route>
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/encryption-documentation" element={<EncryptionDocumentation />} />
      <Route path="*" element={<PageNotFound />} />
      </Routes>
      </Suspense>
      {!['/login', '/register', '/onboarding', '/forgot-password', '/reset-password', '/oauth-consent', '/shared-file'].includes(location.pathname) && <AskNaliHint />}
    </>
  );
};

function App() {
  // Only show the intro splash once per browser session — not on every reload/redirect.
  // Automated/testing browsers (navigator.webdriver) skip it entirely so content renders immediately.
  const [loaded, setLoaded] = useState(() => {
    try {
      if (navigator.webdriver) return true;
      return sessionStorage.getItem('nali_splash_shown') === '1';
    } catch { return false; }
  });
  const { isLowEnd } = usePerformance();
  const { reduceMotion } = useReducedMotionPreference();

  // The assistant is code-split, so an "open" event fired while its chunk is
  // still downloading would be lost. Queue those events and let the assistant
  // replay them once it mounts.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    window.__naliAiQueue = window.__naliAiQueue || [];
    const queue = (e) => {
      if (window.__naliAiReady) return;
      window.__naliAiQueue.push({ type: e.type, detail: e.detail });
    };
    window.addEventListener('open-ai-assistant', queue);
    window.addEventListener('nali-send-message', queue);
    return () => {
      window.removeEventListener('open-ai-assistant', queue);
      window.removeEventListener('nali-send-message', queue);
    };
  }, []);

  const handleSplashDone = () => {
    try { sessionStorage.setItem('nali_splash_shown', '1'); } catch {}
    setLoaded(true);
  };

  // Google Ads gtag bootstrap. GTM may already provide gtag; wait briefly so
  // we can reuse that instance instead of downloading the same Google Ads
  // library twice on first paint. If GTM does not provide it, fall back to the
  // direct Ads loader so conversion events still work.
  useEffect(() => {
    if (typeof window === 'undefined' || window.__gads_loaded) return undefined;

    const timer = window.setTimeout(() => {
      if (window.__gads_loaded) return;
      window.__gads_loaded = true;
      window.dataLayer = window.dataLayer || [];

      const inIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
      const analyticsRelayOrigin = (() => {
        if (!inIframe) return null;
        const host = window.location.hostname.toLowerCase();
        const relayAllowed = host === 'localhost'
          || host === '127.0.0.1'
          || host.includes('preview')
          || host.includes('sandbox');
        if (!relayAllowed) return null;
        try {
          const origin = new URL(document.referrer).origin;
          return origin && origin !== 'null' ? origin : null;
        } catch {
          return null;
        }
      })();

      const existingGtag = typeof window.gtag === 'function' ? window.gtag : null;
      window.gtag = function gtag() {
        if (existingGtag) {
          existingGtag.apply(window, arguments);
        } else {
          window.dataLayer.push(arguments);
        }
        if (analyticsRelayOrigin) {
          try {
            const args = Array.prototype.slice.call(arguments);
            const cmd = args[0];
            window.parent.postMessage({
              type: 'base44_gtag_event',
              event: {
                source: 'gtag',
                timestamp: new Date().toLocaleTimeString(),
                command: cmd,
                params: args.slice(1),
                type: cmd === 'event' ? (args[1] || 'event') : cmd,
              },
            }, analyticsRelayOrigin);
          } catch (_e) {}
        }
      };

      if (!existingGtag) {
        const s = document.createElement('script');
        s.src = 'https://www.googletagmanager.com/gtag/js?id=AW-18416125487';
        s.async = true;
        document.head.appendChild(s);
        window.gtag('js', new Date());
        window.gtag('config', 'AW-18416125487', { send_page_view: false });
      }
    }, 3500);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClientInstance}>
        <AuthProvider>
          <LockedChatsProvider>
            <NaliPresenceProvider>
              <AudioPlayerProvider>
                <MotionConfig reducedMotion={isLowEnd || reduceMotion ? "always" : "user"}>
                  {!loaded && <AppLoader onDone={handleSplashDone} />}
                  {!isLowEnd && <NavRipple />}
                  <Router>
                    <AuthenticatedApp />
                  </Router>
                  {loaded && (
                    <Suspense fallback={null}>
                      <AiAssistant />
                    </Suspense>
                  )}
                  <PwaUpdatePrompt />
                  <Toaster />
                  <SonnerToaster />
                </MotionConfig>
              </AudioPlayerProvider>
            </NaliPresenceProvider>
          </LockedChatsProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App