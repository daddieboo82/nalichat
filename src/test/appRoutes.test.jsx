// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import App from '@/App';

const mockAuthState = vi.hoisted(() => ({
  current: {
    user: null,
    isAuthenticated: false,
    isLoadingAuth: false,
    isLoadingPublicSettings: false,
    authChecked: true,
    authError: null,
    checkUserAuth: vi.fn(),
    navigateToLogin: vi.fn(),
  },
}));
const mockSubscriptionState = vi.hoisted(() => ({
  current: {
    hasAccess: true,
    hasEntitlement: vi.fn(() => true),
    isLoading: false,
  },
}));

vi.mock('@/lib/AuthContext', async () => {
  const React = await import('react');
  return {
    AuthProvider: ({ children }) => <>{children}</>,
    useAuth: () => mockAuthState.current,
  };
});
vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => mockSubscriptionState.current,
}));
vi.mock('@/lib/LockedChatsContext', () => ({
  LockedChatsProvider: ({ children }) => children,
  useLockedChats: () => ({
    isReady: true,
    isUnlocked: true,
    lockedConversationIds: [],
    canAccessConversation: () => true,
  }),
}));
vi.mock('@/components/ui/toaster', () => ({ Toaster: () => null }));
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }));
vi.mock('@/components/layout/AppLoader', () => ({ default: () => null }));
vi.mock('@/components/layout/NavRipple', () => ({ default: () => null }));
vi.mock('@/components/ErrorBoundary', async () => {
  const React = await import('react');
  return { default: class extends React.Component { render() { return this.props.children; } } };
});
vi.mock('@/components/AskNaliHint', () => ({ default: () => <div>Ask Nali Hint</div> }));
vi.mock('@/components/PwaUpdatePrompt', () => ({ default: () => null }));
vi.mock('@/components/layout/AppLayout', async () => {
  const React = await import('react');
  const { Outlet } = await import('react-router-dom');
  return { default: () => <div><span>App Layout</span><Outlet /></div> };
});
vi.mock('@/components/AiAssistant', () => ({ default: () => null }));
vi.mock('@/lib/AudioPlayerContext', () => ({ AudioPlayerProvider: ({ children }) => children }));
vi.mock('@/lib/CartContext', () => ({ CartProvider: ({ children }) => children }));
vi.mock('@/lib/NaliPresenceContext', () => ({ NaliPresenceProvider: ({ children }) => children }));
vi.mock('@/hooks/use-performance', () => ({ usePerformance: () => ({ isLowEnd: true }) }));
vi.mock('@/api/base44Client', () => ({ base44: { auth: { logout: vi.fn() } } }));

vi.mock('@/pages/Login', async () => {
  const { useLocation } = await import('react-router-dom');
  return {
    default: () => {
      const location = useLocation();
      return (
        <div>
          <div>Login Page</div>
          <div data-testid="login-state">{JSON.stringify(location.state ?? null)}</div>
        </div>
      );
    },
  };
});
vi.mock('@/pages/Register', () => ({ default: () => <div>Register Page</div> }));
vi.mock('@/pages/ForgotPassword', () => ({ default: () => <div>Forgot Password Page</div> }));
vi.mock('@/pages/ResetPassword', () => ({ default: () => <div>Reset Password Page</div> }));
vi.mock('@/pages/OAuthConsent', () => ({ default: () => <div>OAuth Consent Page</div> }));
vi.mock('@/pages/Home', () => ({ default: () => <div>Home Page</div> }));
vi.mock('@/pages/Terms', () => ({ default: () => <div>Terms Page</div> }));
vi.mock('@/pages/Privacy', () => ({ default: () => <div>Privacy Page</div> }));
vi.mock('@/pages/Download', () => ({ default: () => <div>Download Page</div> }));
vi.mock('@/pages/ThankYou', () => ({ default: () => <div>Thank You Page</div> }));
vi.mock('@/pages/Onboarding', () => ({ default: () => <div>Onboarding Page</div> }));
vi.mock('@/pages/Messages', () => ({ default: () => <div>Messages Page</div> }));
vi.mock('@/pages/Studio', () => ({ default: () => <div>Studio Page</div> }));
vi.mock('@/components/pricing/PricingPlans', () => ({ default: () => <div>Pricing Page</div> }));

describe('app routing guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.setItem('nali_splash_shown', '1');
    window.history.pushState({}, '', '/');
    mockAuthState.current = {
      user: null,
      isAuthenticated: false,
      isLoadingAuth: false,
      isLoadingPublicSettings: false,
      authChecked: true,
      authError: null,
      checkUserAuth: vi.fn(),
      navigateToLogin: vi.fn(),
    };
    mockSubscriptionState.current = {
      hasAccess: true,
      hasEntitlement: vi.fn(() => true),
      isLoading: false,
    };
  });

  afterEach(() => {
    cleanup();
  });

  it('redirects protected deep links to login while preserving a return target', async () => {
    window.history.pushState({}, '', '/messages');

    render(<App />);

    await screen.findByText('Login Page');
    expect(window.location.pathname).toBe('/login');
    expect(window.location.search).toBe('?returnTo=%2Fmessages');
    expect(screen.getByTestId('login-state').textContent).toBe('null');
  });

  it('forces incomplete authenticated users through onboarding before protected pages', async () => {
    mockAuthState.current = {
      ...mockAuthState.current,
      isAuthenticated: true,
      user: { id: 'u1', onboarding_completed: false, role: 'artist' },
    };
    window.history.pushState({}, '', '/messages');

    render(<App />);

    await screen.findByText('Onboarding Page');
    expect(window.location.pathname).toBe('/onboarding');
  });

  it('keeps legal and download pages reachable mid-onboarding', async () => {
    mockAuthState.current = {
      ...mockAuthState.current,
      isAuthenticated: true,
      user: { id: 'u1', onboarding_completed: false, role: 'artist' },
    };

    window.history.pushState({}, '', '/terms');
    render(<App />);
    await screen.findByText('Terms Page');

    cleanup();
    window.history.pushState({}, '', '/download');
    render(<App />);
    await screen.findByText('Download Page');
  });

  it('keeps OAuth consent reachable without onboarding and hides app overlays', async () => {
    mockAuthState.current = {
      ...mockAuthState.current,
      isAuthenticated: true,
      user: { id: 'u1', onboarding_completed: false, role: 'artist' },
    };
    window.history.pushState({}, '', '/oauth-consent?ctx=test-handle');

    render(<App />);

    await screen.findByText('OAuth Consent Page');
    expect(window.location.pathname).toBe('/oauth-consent');
    expect(screen.queryByText('Ask Nali Hint')).toBeNull();
  });

  it('keeps the thank-you page reachable after checkout even without auth', async () => {
    window.history.pushState({}, '', '/ThankYou?checkout_id=cs_test_123');

    render(<App />);

    await screen.findByText('Thank You Page');
    expect(window.location.pathname).toBe('/ThankYou');
  });

  it('keeps the lowercase thankyou route reachable mid-onboarding', async () => {
    mockAuthState.current = {
      ...mockAuthState.current,
      isAuthenticated: true,
      user: { id: 'u1', onboarding_completed: false, role: 'artist' },
    };
    window.history.pushState({}, '', '/thankyou?checkout_id=cs_test_123');

    render(<App />);

    await screen.findByText('Thank You Page');
    expect(window.location.pathname).toBe('/thankyou');
  });

  it('keeps core chat available to authenticated free users', async () => {
    mockAuthState.current = {
      ...mockAuthState.current,
      isAuthenticated: true,
      user: { id: 'u1', onboarding_completed: true, role: 'artist' },
    };
    mockSubscriptionState.current = {
      hasAccess: false,
      hasEntitlement: vi.fn((entitlement) => entitlement === 'chat.core'),
      isLoading: false,
    };
    window.history.pushState({}, '', '/messages');

    render(<App />);

    await screen.findByText('Messages Page');
    expect(window.location.pathname).toBe('/messages');
  });
});
