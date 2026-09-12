import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';
import { unsubscribeFromRemotePush } from '@/lib/pushNotifications';
import { clearPersistedAuthTokens } from '@/lib/authSession';
import { purgeOutboundQueueForUser } from '@/lib/outboundQueue';
import { useQueryClient } from '@tanstack/react-query';

const AuthContext = createContext();

const getAuthErrorStatus = (error) => {
  const raw = error?.status ?? error?.response?.status ?? error?.data?.status;
  const status = Number(raw);
  return Number.isFinite(status) ? status : null;
};

const shouldRetryAuthError = (error) => {
  const status = getAuthErrorStatus(error);
  if (status === 401) return false;
  if (status == null) return true;
  return status === 403
    || status === 404
    || status === 408
    || status === 409
    || status === 425
    || status === 429
    || status >= 500;
};

export const AuthProvider = ({ children }) => {
  const queryClient = useQueryClient();
  const lastUserIdRef = useRef(null);
  const authCheckGenerationRef = useRef(0);
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
      try {
        const publicSettings = await appClient.get(`/prod/public-settings/by-id/${appParams.appId}`);
        if (publicSettings) setAppPublicSettings(publicSettings);
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

      // Always resolve the user session, even when there is no bearer token.
      // Google/platform OAuth may complete with a same-origin cookie-backed
      // session and no access_token in the callback URL. Requiring appParams.token
      // here incorrectly treated that valid SSO session as logged out.
      await checkUserAuth();
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

  const checkUserAuth = useCallback(async (retryCount = 0, existingGeneration = null) => {
    const generation = existingGeneration ?? ++authCheckGenerationRef.current;
    try {
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();
      if (generation !== authCheckGenerationRef.current) return null;
      const previousUserId = lastUserIdRef.current;
      if (previousUserId && previousUserId !== currentUser?.id) {
        purgeOutboundQueueForUser(previousUserId);
        queryClient.clear();
      }
      lastUserIdRef.current = currentUser?.id || null;
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null); // clear any stale error from a failed public-settings call
      setIsLoadingAuth(false);
      setAuthChecked(true);
      return currentUser;
    } catch (error) {
      console.error('User auth check failed:', error);
      // Retry only transient/propagation failures. A 401 is authoritative:
      // retrying it only leaves users staring at a spinner before they are
      // returned to the logged-out state. Fresh OAuth user propagation can
      // still surface as 403/404 briefly, so those remain retryable.
      if (retryCount < 3 && shouldRetryAuthError(error)) {
        const delay = retryCount === 0 ? 750 : retryCount === 1 ? 1500 : 3000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        if (generation !== authCheckGenerationRef.current) return null;
        return checkUserAuth(retryCount + 1, generation);
      }
      if (generation !== authCheckGenerationRef.current) return null;
      setIsLoadingAuth(false);
      if (lastUserIdRef.current) queryClient.clear();
      lastUserIdRef.current = null;
      setUser(null);
      setIsAuthenticated(false);
      setAuthChecked(true);
      // Do NOT clear the token — clearing it on a transient failure is the
      // race condition that causes the app to revert to logged-out right
      // after a successful login.  Only logout() clears the token.
      return null;
    }
  }, [queryClient]);

  const logout = useCallback(async () => {
    // Invalidate any profile/session refresh already in flight before logout
    // begins so it cannot repopulate auth state after this transition.
    authCheckGenerationRef.current += 1;

    // Remove this browser's remote push capability while the authenticated
    // session still exists, then terminate the server/cookie-backed session.
    try {
      await unsubscribeFromRemotePush();
    } catch (error) {
      console.error('Push unsubscribe failed:', error);
    }

    // Mark this account offline while the authenticated session is still valid.
    // The app-shell presence cleanup runs after auth state flips and may no longer
    // have permission to update the server record.
    try {
      await base44.functions.invoke('updateUserPresence', { isOnline: false });
    } catch (error) {
      console.error('Presence offline update failed:', error);
    }

    const departingUserId = lastUserIdRef.current;
    try {
      await base44.auth.logout();
    } catch (error) {
      console.error('Server logout failed:', error);
    } finally {
      purgeOutboundQueueForUser(departingUserId);
      clearPersistedAuthTokens();
      try { localStorage.removeItem('last_activity'); } catch {}
      queryClient.clear();
      lastUserIdRef.current = null;
      setUser(null);
      setIsAuthenticated(false);
      setAuthChecked(true);
    }
  }, [queryClient]);

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