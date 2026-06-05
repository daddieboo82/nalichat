import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import { usePerformance } from '@/hooks/use-performance';
import { useState, useEffect, useRef } from 'react';
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
import Messages from '@/pages/Messages';
import Files from '@/pages/Files';

import Settings from '@/pages/Settings';
import Explore from '@/pages/Explore';
import Leaderboard from '@/pages/Leaderboard';
import Profile from '@/pages/Profile';
import Playlists from '@/pages/Playlists';
import PlaylistDetail from '@/pages/PlaylistDetail';
import Analytics from '@/pages/Analytics';
import ThankYou from '@/pages/ThankYou';
import Onboarding from '@/pages/Onboarding';
import { useSubscription } from '@/hooks/useSubscription';
import PricingPlans from '@/components/pricing/PricingPlans';
import Privacy from '@/pages/Privacy';
import Studio from '@/pages/Studio';
import Record from '@/pages/Record';
import CoverArt from '@/pages/CoverArt';
import AiAssistant from '@/components/AiAssistant';
import AskNaliHint from '@/components/AskNaliHint';
import { base44 } from '@/api/base44Client';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isInitialMount = useRef(true);

  const { user } = useAuth();
  const { hasAccess, isLoading: subLoading } = useSubscription();

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

  if (isLoadingPublicSettings || isLoadingAuth || (isAuthenticated && subLoading)) {
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

  if (isAuthenticated && user && !user.onboarding_completed && location.pathname !== '/onboarding' && location.pathname !== '/login' && location.pathname !== '/register') {
    return <Navigate to="/onboarding" replace />;
  }

  if (isAuthenticated && user && user.onboarding_completed && !hasAccess && location.pathname !== '/pricing' && location.pathname !== '/login' && location.pathname !== '/register' && location.pathname !== '/settings' && location.pathname !== '/profile' && !location.pathname.startsWith('/thank-you') && !location.pathname.startsWith('/ThankYou')) {
    return <Navigate to="/pricing" replace />;
  }

  return (
    <>
      <Routes location={location}>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/onboarding" element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />}><Onboarding /></ProtectedRoute>} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/pricing" element={<PricingPlans />} />
        <Route path="/PricingPlans" element={<PricingPlans />} />
      </Route>
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          <Route path="/messages" element={<Messages />} />
          <Route path="/files" element={<Files />} />

          <Route path="/settings" element={<Settings />} />
          <Route path="/studio" element={<Studio />} />
          <Route path="/record" element={<Record />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/playlists" element={<Playlists />} />
          <Route path="/playlist/:playlistId" element={<PlaylistDetail />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/ThankYou" element={<ThankYou />} />
          <Route path="/cover-art" element={<CoverArt />} />
        </Route>
      </Route>
      <Route path="/privacy" element={<Privacy />} />
      <Route path="*" element={<PageNotFound />} />
      </Routes>
    </>
  );
};

function App() {
  const [loaded, setLoaded] = useState(false);
  const { isLowEnd } = usePerformance();

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClientInstance}>
        <AuthProvider>
          <AudioPlayerProvider>
            <CartProvider>
              <MotionConfig reducedMotion={isLowEnd ? "always" : "user"}>
                {!loaded && <AppLoader onDone={() => setLoaded(true)} />}
                {!isLowEnd && <NavRipple />}
                <Router>
                  <AuthenticatedApp />
                </Router>
                {loaded && <AiAssistant />}
                {loaded && <AskNaliHint />}
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