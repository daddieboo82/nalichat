import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';
import { unsubscribeFromRemotePush } from '@/lib/pushNotifications';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      
      // First, check app public settings (with token if available)
      // This will tell us if auth is required, user not registered, etc.
      const appClient = createAxiosClient({
        baseURL: `/api/apps/public`,
        headers: {
          'X-App-Id': appParams.appId
        },
        token: appParams.token, // Include token if available
        interceptResponses: true
      });
      
      // Fetch public settings first.  If this fails we still try to resolve the
      // user session below — a 403 on public-settings for a brand-new Google
      // user must not swallow the valid access_token and leave the app logged out.
      let publicSettingsOk = false;
      try {
        const publicSettings = await appClient.get(`/prod/public-settings/by-id/${appParams.appId}`);
        if (publicSettings) setAppPublicSettings(publicSettings);
        publicSettingsOk = true;
      } catch (appError) {
        console.error('App state check failed:', appError);
        if (appError?.status === 403 && appError?.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;
          if (reason === 'auth_required') {
            setAuthError({ type: 'auth_required', message: 'Authentication required' });
          } else if (reason === 'user_not_registered') {
            // For a brand-new Google OAuth user the user record may not be
            // propagated yet, causing public-settings to 403 with
            // user_not_registered even though the access_token is valid.
            // Do NOT set authError here when we have a token — checkUserAuth()
            // will call me() and clear the error on success.  Only surface
            // the error if there is no token to fall back on.
            if (!appParams.token) {
              setAuthError({ type: 'user_not_registered', message: 'User not registered for this app' });
            }
          } else {
            setAuthError({ type: reason, message: appError.message || 'Access Denied' });
          }
        } else if (!appParams.token) {
          setAuthError({ type: 'unknown', message: appError?.message || 'Failed to load app' });
        }
      }

      // Always resolve the user session if we have a token, regardless of
      // whether public-settings succeeded.  This is the critical path for
      // Google OAuth: the redirect delivers a valid access_token, but the old
      // code skipped me() entirely when public-settings threw, so the user
      // appeared logged out despite a successful login.
      if (appParams.token) {
        await checkUserAuth();
      } else if (publicSettingsOk) {
        setIsLoadingAuth(false);
        setIsAuthenticated(false);
        setAuthChecked(true);
      } else {
        setIsLoadingAuth(false);
        setIsAuthenticated(false);
        setAuthChecked(true);
      }
      setIsLoadingPublicSettings(false);
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async (retryCount = 0) => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null); // clear any stale error from a failed public-settings call
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      console.error('User auth check failed:', error);
      // Retry up to 3 times with increasing delays — right after Google OAuth
      // the user record may not be propagated yet, causing me() to 404/403.
      // The token is valid; the record usually appears within a few seconds.
      if (retryCount < 3) {
        const delay = retryCount === 0 ? 1500 : retryCount === 1 ? 3000 : 5000;
        setTimeout(() => checkUserAuth(retryCount + 1), delay);
        return;
      }
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);
      // Do NOT clear the token — clearing it on a transient failure is the
      // race condition that causes the app to revert to logged-out right
      // after a successful login.  Only logout() clears the token.
    }
  };

  const logout = async () => {
    // Remove this browser's remote push capability while the authenticated
    // session still exists, then terminate the server/cookie-backed session.
    try {
      await unsubscribeFromRemotePush();
    } catch (error) {
      console.error('Push unsubscribe failed:', error);
    }

    try {
      await base44.auth.logout();
    } catch (error) {
      console.error('Server logout failed:', error);
    } finally {
      try {
        localStorage.removeItem('base44_access_token');
        localStorage.removeItem('base44_token');
        sessionStorage.removeItem('base44_access_token');
        sessionStorage.removeItem('base44_token');
      } catch (e) {}
      setUser(null);
      setIsAuthenticated(false);
      setAuthChecked(true);
    }
  };

  const navigateToLogin = () => {
    // Navigate to the custom login page if available
    window.location.href = '/login?returnTo=' + encodeURIComponent(window.location.pathname);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};