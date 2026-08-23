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

import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

import AppLayout from '@/components/layout/AppLayout';
import Home from '@/pages/Home';
import AiAssistant from '@/components/AiAssistant';
import AskNaliHint from '@/components/AskNaliHint';
import { base44 } from '@/api/base44Client';

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
const Studio = lazy(() => import('@/pages/Studio'));
const AdminDashboard = lazy(() => import('@/pages/AdminDashboard'));
const Record = lazy(() => import('@/pages/Record'));
const CoverArt = lazy(() => import('@/pages/CoverArt'));
const WebhookTest = lazy(() => import('@/pages/WebhookTest'));
const ProjectsSummary = lazy(() => import('@/pages/ProjectsSummary'));

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isInitialMount = useRef(true);

  const { user } = useAuth();

  useEffect(() => {
    isInitialMount.current = false;
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
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
    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('touchstart', updateActivity);
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

  if (isAuthenticated && user && !user.onboarding_completed && location.pathname.toLowerCase() !== '/onboarding' && location.pathname !== '/login' && location.pathname !== '/register') {
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
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/business" element={<Navigate to="/admin" replace />} />
        </Route>
      </Route>
      <Route path="/privacy" element={<Privacy />} />
      <Route path="*" element={<PageNotFound />} />
      </Routes>
      </Suspense>
      {!['/login', '/register', '/onboarding', '/forgot-password', '/reset-password'].includes(location.pathname) && <AskNaliHint />}
    </>
  );
};

function App() {
  // Only show the intro splash once per browser session — not on every reload/redirect
  const [loaded, setLoaded] = useState(() => {
    try { return sessionStorage.getItem('nali_splash_shown') === '1'; } catch { return false; }
  });
  const { isLowEnd } = usePerformance();

  const handleSplashDone = () => {
    try { sessionStorage.setItem('nali_splash_shown', '1'); } catch {}
    setLoaded(true);
  };

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClientInstance}>
        <AuthProvider>
          <AudioPlayerProvider>
            <CartProvider>
              <MotionConfig reducedMotion={isLowEnd ? "always" : "user"}>
                {!loaded && <AppLoader onDone={handleSplashDone} />}
                {!isLowEnd && <NavRipple />}
                <Router>
                  <AuthenticatedApp />
                </Router>
                {loaded && <AiAssistant />}
                <Toaster />
                <SonnerToaster />
              </MotionConfig>
            </CartProvider>
          </AudioPlayerProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App