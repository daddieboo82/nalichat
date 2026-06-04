import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLoader from '@/components/layout/AppLoader';
import NavRipple from '@/components/layout/NavRipple';
import ErrorBoundary from '@/components/ErrorBoundary';
import { OnboardingProvider, useOnboarding } from '@/lib/OnboardingContext';
import OnboardingOverlay from '@/components/onboarding/OnboardingOverlay';
import { MediaPlayerProvider } from '@/lib/MediaPlayerContext.jsx';
import GlobalMediaPlayer from '@/components/media/GlobalMediaPlayer';

import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

import AppLayout from '@/components/layout/AppLayout';
import Home from '@/pages/Home';
import Messages from '@/pages/Messages';
import Network from '@/pages/Network';
import Files from '@/pages/Files';
import StudioNew from '@/pages/StudioNew';
import StudioEditor from '@/pages/StudioEditor';
import Settings from '@/pages/Settings';
import Explore from '@/pages/Explore';
import Leaderboard from '@/pages/Leaderboard';
import Profile from '@/pages/Profile';
import Playlists from '@/pages/Playlists';
import PlaylistDetail from '@/pages/PlaylistDetail';
import Analytics from '@/pages/Analytics';
import ThankYou from '@/pages/ThankYou';
import PricingPlans from '@/components/pricing/PricingPlans';
import Privacy from '@/pages/Privacy';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const { isFirstTime, skipOnboarding } = useOnboarding();
  const location = useLocation();
  const [showOnboarding, setShowOnboarding] = useState(isFirstTime);

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <p className="text-sm text-muted-foreground font-heading">Loading studio...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <>
      <OnboardingOverlay 
        isOpen={showOnboarding && !location.pathname.includes('/login') && !location.pathname.includes('/register')}
        onComplete={() => {
          setShowOnboarding(false);
          skipOnboarding();
        }}
        completedSteps={new Set()}
      />
      <GlobalMediaPlayer />
      <AnimatePresence mode="wait">
      <Routes location={location}>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/explore" element={<Explore />} />
      </Route>
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          <Route path="/messages" element={<Messages />} />
          <Route path="/network" element={<Network />} />
          <Route path="/files" element={<Files />} />
          <Route path="/studio" element={<StudioNew />} />
          <Route path="/studio-editor" element={<StudioEditor />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/playlists" element={<Playlists />} />
          <Route path="/playlist/:playlistId" element={<PlaylistDetail />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/thank-you" element={<ThankYou />} />
          <Route path="/pricing" element={<PricingPlans />} />
        </Route>
      </Route>
      <Route path="/privacy" element={<Privacy />} />
      <Route path="*" element={<PageNotFound />} />
      </Routes>
      </AnimatePresence>
    </>
  );
};

function App() {
  const [loaded, setLoaded] = useState(false);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <OnboardingProvider>
          <MediaPlayerProvider>
            <QueryClientProvider client={queryClientInstance}>
            {!loaded && <AppLoader onDone={() => setLoaded(true)} />}
            <NavRipple />
            <Router>
              <AuthenticatedApp />
            </Router>
            <Toaster />
            </QueryClientProvider>
            </MediaPlayerProvider>
            </OnboardingProvider>
            </AuthProvider>
            </ErrorBoundary>
            )
}

export default App