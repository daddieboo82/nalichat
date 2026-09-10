import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import { usePerformance } from '@/hooks/use-performance';
import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLoader from '@/components/layout/AppLoader';
import NavRipple from '@/components/layout/NavRipple';
import ErrorBoundary from '@/components/ErrorBoundary';
import { AudioPlayerProvider } from '@/lib/AudioPlayerContext';
import { CartProvider } from '@/lib/CartContext';
import { NaliPresenceProvider } from '@/lib/NaliPresenceContext';

import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

import AppLayout from '@/components/layout/AppLayout';
import Home from '@/pages/Home';
import AskNaliHint from '@/components/AskNaliHint';
import PwaUpdatePrompt from '@/components/PwaUpdatePrompt';
import { base44 } from '@/api/base44Client';

// The assistant pulls in the whole react-markdown/unified stack, which added
// ~150 kB to the entry chunk even though the panel only renders once the user
// opens it. Load it after first paint instead.
const AiAssistant = lazy(() => import('@/components/AiAssistant'));

// Lazily-loaded routes — each downloads on demand so initial load & tab-switching are fastest.
const Messages = lazy(() => import('@/pages/Messages'));
const Files = lazy(() => import('@/pages/Files'));
const Settings = lazy(() => import('@/pages/Settings'));
const Explore = lazy(() => import('@/pages/Explore'));
const Leaderboard = lazy(() => import('@/pages/Leaderboard'));
const Profile = lazy(() => import('@/pages/Profile'));
const Playlists = lazy(() => import('@/pages/Playlists'));
const PlaylistDetail = lazy(() => import('@/pages/PlaylistDetail'));
const Analytics = lazy(() => import('@/pages/Analytics'));
const ThankYou = lazy(() => import('@/pages/ThankYou'));
const Onboarding = lazy(() => import('@/pages/Onboarding'));
const PricingPlans = lazy(() => import('@/components/pricing/PricingPlans'));
const Privacy = lazy(() => import('@/pages/Privacy'));
const Terms = lazy(() => import('@/pages/Terms'));
const EncryptionDocumentation = lazy(() => import('@/pages/EncryptionDocumentation'));
const Studio = lazy(() => import('@/pages/Studio'));
const AdminDashboard = lazy(() => import('@/pages/AdminDashboard'));
const Record = lazy(() => import('@/pages/Record'));
const CoverArt = lazy(() => import('@/pages/CoverArt'));
const WebhookTest = lazy(() => import('@/pages/WebhookTest'));
const ProjectsSummary = lazy(() => import('@/pages/ProjectsSummary'));
const ChallengeHub = lazy(() => import('@/pages/ChallengeHub'));
const CreateChallenge = lazy(() => import('@/pages/CreateChallenge'));
const ChallengeDetail = lazy(() => import('@/pages/ChallengeDetail'));
const ChallengeLeaderboard = lazy(() => import('@/pages/ChallengeLeaderboard'));
const SubmissionPlayer = lazy(() => import('@/pages/SubmissionPlayer'));
const Squad = lazy(() => import('@/pages/Squad'));
const SquadJoin = lazy(() => import('@/pages/SquadJoin'));
const ViralSeed = lazy(() => import('@/pages/ViralSeed'));
const Download = lazy(() => import('@/pages/Download'));

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isInitialMount = useRef(true);

  const { user } = useAuth();

  useEffect(() => {
    isInitialMount.current = false;
  }, []);

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
    if (!isNewSignup || localStorage.getItem(key)) return;
    let tries = 0;
    const fire = () => {
        if (!window.gtag) { if (tries++ < 20) setTimeout(fire, 250); return; }
        if (localStorage.getItem(key)) return;
        localStorage.setItem(key, '1');
        window.gtag('event', 'conversion', {
            send_to: 'AW-18416125487/twIWCJHa5OkcEK-Mv81E',
            transaction_id: user.id,
        });
    };
    fire();
  }, [user]);

  useEffect(() => {
    if (!isAuthenticated) return;
    // Reset the activity timestamp on session start so a stale value from a
    // previous session doesn't immediately log the user out right after login.
    localStorage.setItem('last_activity', Date.now().toString());
    const checkActivity = () => {
      const lastActive = localStorage.getItem('last_activity');
      if (lastActive && Date.now() - parseInt(lastActive, 10) > 24 * 60 * 60 * 1000) {
        base44.auth.logout();
      }
    };
    checkActivity();
    const updateActivity = () => localStorage.setItem('last_activity', Date.now().toString());
    window.addEventListener('mousemove', updateActivity, { passive: true });
    window.addEventListener('keydown', updateActivity, { passive: true });
    window.addEventListener('touchstart', updateActivity, { passive: true });
    window.addEventListener('play', updateActivity, { passive: true, capture: true });
    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('touchstart', updateActivity);
      window.removeEventListener('play', updateActivity);
    };
  }, [isAuthenticated]);

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <p className="text-sm text-muted-foreground font-heading">Loading app...</p>
        </div>
      </div>
    );
  }

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
    '/privacy', '/terms', '/download',
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

  // The app is completely free — no paywall. All users have full access.
  // Monetization is through per-item sales (tracks, files) via the cart/checkout flow.

  return (
    <>
      <Suspense fallback={
        <div className="fixed inset-0 flex items-center justify-center bg-background">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      }>
      <Routes location={location}>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
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
      <Route path="/viral-seed" element={<ViralSeed />} />
      </Route>
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route path="/studio" element={<Studio />} />
        <Route element={<AppLayout />}>
          <Route path="/messages" element={<Messages />} />
          <Route path="/files" element={<Files />} />

          <Route path="/settings" element={<Settings />} />
          <Route path="/record" element={<Record />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/playlists" element={<Playlists />} />
          <Route path="/playlist/:playlistId" element={<PlaylistDetail />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/ThankYou" element={<ThankYou />} />
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
      <Route path="/download" element={<Download />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/encryption-documentation" element={<EncryptionDocumentation />} />
      <Route path="*" element={<PageNotFound />} />
      </Routes>
      </Suspense>
      {!['/login', '/register', '/onboarding', '/forgot-password', '/reset-password'].includes(location.pathname) && <AskNaliHint />}
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

  // Google Ads gtag bootstrap — loads once; cross-origin relay powers the event debugger.
  useEffect(() => {
    if (typeof window === 'undefined' || window.__gads_loaded) return;
    window.__gads_loaded = true;
    window.dataLayer = window.dataLayer || [];
    const inIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
      if (inIframe) {
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
          }, '*');
        } catch (_e) {}
      }
    };
    const s = document.createElement('script');
    s.src = 'https://www.googletagmanager.com/gtag/js?id=AW-18416125487';
    s.async = true;
    document.head.appendChild(s);
    window.gtag('js', new Date());
    window.gtag('config', 'AW-18416125487', { send_page_view: false });
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClientInstance}>
        <AuthProvider>
          <NaliPresenceProvider>
            <AudioPlayerProvider>
              <CartProvider>
                <MotionConfig reducedMotion={isLowEnd ? "always" : "user"}>
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
              </CartProvider>
            </AudioPlayerProvider>
          </NaliPresenceProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App