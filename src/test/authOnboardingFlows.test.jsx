// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Onboarding from '@/pages/Onboarding';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import ProtectedRoute from '@/components/ProtectedRoute';

const mockBase44 = vi.hoisted(() => ({
  functions: { invoke: vi.fn() },
  auth: {
    loginViaEmailPassword: vi.fn(),
    loginWithProvider: vi.fn(),
    register: vi.fn(),
    verifyOtp: vi.fn(),
    resendOtp: vi.fn(),
    updateMe: vi.fn(),
    resetPasswordRequest: vi.fn(),
    resetPassword: vi.fn(),
    me: vi.fn(),
    setToken: vi.fn(),
  },
}));

const mockAuthState = vi.hoisted(() => ({
  current: {
    user: null,
    isAuthenticated: false,
    isLoadingAuth: false,
    isLoadingPublicSettings: false,
    authChecked: true,
    authError: null,
    checkUserAuth: vi.fn(),
  },
}));

const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}));

const mockToastObject = vi.hoisted(() => vi.fn());

vi.mock('@/api/base44Client', () => ({ base44: mockBase44 }));
vi.mock('@/components/AuthLayout', () => ({
  default: ({ title, subtitle, footer, children }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
      {footer}
    </div>
  ),
}));
vi.mock('@/components/GoogleIcon', () => ({ default: () => <span>GoogleIcon</span> }));
vi.mock('sonner', () => ({ toast: mockToast }));
vi.mock('@/components/ui/use-toast', () => ({ toast: mockToastObject }));
vi.mock('@/components/onboarding/OnboardingNaliGuide', () => ({ default: () => <div data-testid="nali-guide" /> }));
vi.mock('@/components/ui/input-otp', () => ({
  InputOTP: ({ value, onChange }) => (
    <input aria-label="OTP" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
  InputOTPGroup: ({ children }) => <div>{children}</div>,
  InputOTPSlot: () => null,
}));
vi.mock('@/lib/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => mockAuthState.current,
}));
vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({
    subscription: {
      plan: 'free',
      status: 'inactive',
      hasAccess: false,
      hasPending: false,
      currentPeriodEnd: null,
    },
    hasAccess: false,
    isLoading: false,
    isPro: false,
    isProFilesharing: false,
    isTrialActive: false,
    refetch: vi.fn(),
  }),
}));

const renderInRouter = (ui, initialEntries = ['/']) =>
  render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);

describe('auth and onboarding flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    mockAuthState.current = {
      user: null,
      isAuthenticated: false,
      isLoadingAuth: false,
      isLoadingPublicSettings: false,
      authChecked: true,
      authError: null,
      checkUserAuth: vi.fn(),
    };
  });

  afterEach(() => {
    cleanup();
  });

  it('persists a successful email/password login before redirecting', async () => {
    mockBase44.auth.loginViaEmailPassword.mockResolvedValueOnce({ access_token: 'session-token' });
    localStorage.setItem('last_activity', '1');

    renderInRouter(<Login />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'sample-pass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => {
      expect(localStorage.getItem('base44_access_token')).toBe('session-token');
      expect(Number(localStorage.getItem('last_activity'))).toBeGreaterThan(1);
      expect(mockBase44.auth.setToken).toHaveBeenCalledWith('session-token');
    });
  });

  it('shows login errors and guidance for invalid credentials', async () => {
    mockBase44.auth.loginViaEmailPassword.mockRejectedValueOnce(new Error('Invalid email or password'));

    renderInRouter(<Login />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'bad@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    await screen.findByText('Invalid email or password.');
    expect(screen.getByText(/If you originally signed up with Google/)).toBeTruthy();
    expect(mockToast.error).toHaveBeenCalledWith('Invalid email or password.');
  });

  it('shows Google sign-in entry points on login and register and launches provider auth', () => {
    localStorage.setItem('base44_access_token', 'stale-token');
    localStorage.setItem('last_activity', '1');
    sessionStorage.setItem('base44_token', 'stale-token');

    const { unmount } = renderInRouter(<Login />);

    fireEvent.click(screen.getByRole('button', { name: /Continue with Google/i }));
    expect(localStorage.getItem('base44_access_token')).toBeNull();
    expect(Number(localStorage.getItem('last_activity'))).toBeGreaterThan(1);
    expect(sessionStorage.getItem('base44_token')).toBeNull();
    expect(mockBase44.auth.loginWithProvider).toHaveBeenCalledWith('google', '/');

    unmount();
    renderInRouter(<Register />);

    fireEvent.click(screen.getByRole('button', { name: /Join free with Google/i }));
    expect(sessionStorage.getItem('is_new_user')).toBe('true');
    expect(mockBase44.auth.loginWithProvider).toHaveBeenLastCalledWith('google', '/');
  });

  it('blocks registration when passwords do not match', async () => {
    renderInRouter(<Register />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pass12345' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'different' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await screen.findByText('Passwords do not match');
    expect(mockBase44.auth.register).not.toHaveBeenCalled();
  });

  it('transitions into OTP verification and supports failed verify plus resend', async () => {
    mockBase44.auth.register.mockResolvedValueOnce(undefined);
    mockBase44.auth.verifyOtp.mockRejectedValueOnce(new Error('Invalid verification code'));
    mockBase44.auth.resendOtp.mockResolvedValueOnce(undefined);

    renderInRouter(<Register />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pass12345' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'pass12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await screen.findByText('Verify your email');
    fireEvent.change(screen.getByLabelText('OTP'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    await screen.findByText('That verification code is invalid. Check the code and try again.');

    const resendButton = screen.getByRole('button', { name: /Resend in 30s/i });
    expect(resendButton.disabled).toBe(true);
    expect(mockBase44.auth.resendOtp).not.toHaveBeenCalled();
  });

  it('requires display name and birthdate before onboarding can complete', async () => {
    mockAuthState.current = {
      ...mockAuthState.current,
      user: { id: '507f1f77bcf86cd799439011', display_name: '', full_name: '', birthdate: '', bio: '', location: '' },
      isAuthenticated: true,
    };

    renderInRouter(<Onboarding />);
    fireEvent.click(screen.getByRole('button', { name: 'Enter NaliBase' }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Please fill in your name and birthdate');
    });
    expect(mockBase44.functions.invoke).not.toHaveBeenCalled();
  });

  it('saves onboarding profile data and refreshes auth state', async () => {
    const checkUserAuth = vi.fn().mockResolvedValue({ id: '507f1f77bcf86cd799439012', onboarding_completed: true });
    mockAuthState.current = {
      ...mockAuthState.current,
      user: { id: '507f1f77bcf86cd799439012', display_name: '', full_name: 'New User', birthdate: '', bio: '', location: '' },
      isAuthenticated: true,
      checkUserAuth,
    };
    mockBase44.functions.invoke.mockResolvedValueOnce({ data: {
      success: true,
      action: 'complete_onboarding',
      userId: '507f1f77bcf86cd799439012',
      onboardingCompleted: true,
    } });

    const { container } = renderInRouter(<Onboarding />);
    fireEvent.change(screen.getByPlaceholderText('What should we call you?'), { target: { value: 'Fresh Artist' } });
    fireEvent.change(container.querySelector('input[type="date"]'), { target: { value: '2000-01-01' } });
    fireEvent.change(screen.getByPlaceholderText('A short bio about your music (optional)'), { target: { value: 'Hello world' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enter NaliBase' }));

    await waitFor(() => {
      expect(mockBase44.functions.invoke).toHaveBeenCalledWith('completeOnboarding', {
        display_name: 'Fresh Artist',
        birthdate: '2000-01-01',
        bio: 'Hello world',
        location: '',
      });
      expect(checkUserAuth).toHaveBeenCalled();
    });
  });

  it('shows generic success state for forgot password even when request fails', async () => {
    mockBase44.auth.resetPasswordRequest.mockRejectedValueOnce(new Error('hidden'));

    renderInRouter(<ForgotPassword />);
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    await screen.findByText(/If an account exists with that email/);
  });

  it('renders the invalid reset-token recovery state', () => {
    renderInRouter(<ResetPassword />, ['/reset-password']);
    expect(screen.getByText('Invalid reset link')).toBeTruthy();
    expect(screen.getByText(/request a new password reset email/i)).toBeTruthy();
  });

  it('renders the unauthenticated element for protected routes and a banned state when needed', () => {
    const { rerender } = renderInRouter(
      <ProtectedRoute unauthenticatedElement={<div>Go to login</div>}>
        <div>Secret</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Go to login')).toBeTruthy();

    mockAuthState.current = {
      ...mockAuthState.current,
      isAuthenticated: true,
      user: { is_banned: true },
    };

    rerender(
      <MemoryRouter>
        <ProtectedRoute unauthenticatedElement={<div>Go to login</div>}>
          <div>Secret</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('Account Banned')).toBeTruthy();
  });
});
