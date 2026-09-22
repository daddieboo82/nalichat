// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Home from '@/pages/Home';
import DesktopNav from '@/components/navigation/DesktopNav';
import MobileNav from '@/components/navigation/MobileNav';
import MobileHeader from '@/components/navigation/MobileHeader';
import WelcomeTour from '@/components/onboarding/WelcomeTour';
import NotificationBell from '@/components/notifications/NotificationBell';

const mockBase44 = vi.hoisted(() => ({
  auth: {
    me: vi.fn(),
    updateMe: vi.fn(),
  },
  functions: {
    invoke: vi.fn(),
  },
  entities: {
    Conversation: { list: vi.fn() },
    Notification: {
      filter: vi.fn(),
      subscribe: vi.fn(() => () => {}),
      update: vi.fn(),
    },
  },
}));

const mockAuthState = vi.hoisted(() => ({
  current: {
    user: null,
    isAuthenticated: false,
    logout: vi.fn(),
  },
}));

const mockCartState = vi.hoisted(() => ({
  current: {
    items: [],
    setIsOpen: vi.fn(),
  },
}));

const mockToast = vi.hoisted(() => vi.fn());
const mockPush = vi.hoisted(() => ({
  registerServiceWorker: vi.fn(() => Promise.resolve()),
  requestPushPermission: vi.fn(),
  showPushNotification: vi.fn(),
  getPermissionStatus: vi.fn(() => 'default'),
}));

vi.mock('@/api/base44Client', () => ({ base44: mockBase44 }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => mockAuthState.current }));
vi.mock('@/lib/LockedChatsContext', () => ({
  useLockedChats: () => ({
    isReady: true,
    isUnlocked: true,
    lockedConversationIds: [],
    canAccessConversation: () => true,
  }),
}));
vi.mock('@/lib/CartContext', () => ({ useCart: () => mockCartState.current }));
vi.mock('@/hooks/use-sound', () => ({
  sounds: { click: vi.fn(), nav: vi.fn(), like: vi.fn(), notification: vi.fn() },
}));
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: () => ({ children, layoutId, initial, animate, exit, transition, variants, whileHover, whileTap, custom, ...props }) => (
      <div {...props}>{children}</div>
    ),
  }),
  AnimatePresence: ({ children }) => <>{children}</>,
}));
vi.mock('@/components/layout/PullToRefresh', () => ({
  default: ({ children }) => <div>{children}</div>,
}));
vi.mock('@/components/home/QuickStartGuide', () => ({ default: () => <div>Quick Start Guide</div> }));
vi.mock('@/components/home/StudioTutorial', () => ({ default: () => <div>Studio Tutorial</div> }));
vi.mock('@/components/home/HowItWorks', () => ({ default: () => <div>How It Works</div> }));
vi.mock('@/components/home/DonationButton', () => ({ default: () => <button>Donate</button> }));
vi.mock('@/components/onboarding/ImmersiveOnboarding', () => ({
  default: ({ onDismiss }) => <button onClick={onDismiss}>Immersive Onboarding</button>,
  VISITOR_ONBOARDING_STORAGE_KEY: 'nali_onboarding_seen',
}));
vi.mock('@/components/navigation/RecentlyVisited', () => ({ default: () => <div>Recently Visited</div> }));
vi.mock('@/components/branding/Logo', () => ({ default: () => <div>Logo</div> }));
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ open, onOpenChange, children }) => <div data-open={open}>{children}</div>,
  SheetContent: ({ children }) => <div>{children}</div>,
  SheetHeader: ({ children }) => <div>{children}</div>,
  SheetTitle: ({ children }) => <div>{children}</div>,
  SheetDescription: ({ children }) => <div>{children}</div>,
}));
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick, asChild, ...props }) => {
    if (asChild) return React.cloneElement(children, props);
    return <button onClick={onClick}>{children}</button>;
  },
}));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));
vi.mock('@/lib/pushNotifications', () => mockPush);

const renderWithProviders = (ui, initialEntries = ['/']) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
};

function MobileNavHarness() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <>
      <MobileNav />
      <div data-testid="location">{location.pathname + location.search}</div>
      <Routes>
        <Route path="/" element={<div>Home page</div>} />
        <Route path="/explore" element={<div>Explore page</div>} />
        <Route path="/messages" element={<div>Messages page</div>} />
        <Route path="/profile" element={<button onClick={() => navigate('/profile?id=42')}>Go profile detail</button>} />
      </Routes>
    </>
  );
}

describe('home, navigation, and recovery flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    mockAuthState.current = { user: null, isAuthenticated: false, authChecked: true, logout: vi.fn() };
    mockCartState.current = { items: [], setIsOpen: vi.fn() };
    mockBase44.auth.me.mockResolvedValue(null);
    mockBase44.auth.updateMe.mockResolvedValue(undefined);
    mockBase44.functions.invoke.mockResolvedValue({ data: { success: true } });
    mockBase44.entities.Conversation.list.mockResolvedValue([]);
    mockBase44.entities.Notification.filter.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it('shows the anonymous home conversion flow immediately on first visit', async () => {
    renderWithProviders(<Home />);

    expect(screen.queryByRole('button', { name: 'Immersive Onboarding' })).toBeNull();
    expect(screen.getAllByRole('link', { name: /Start Free/i }).length).toBeGreaterThan(0);
    expect(screen.getByText('Quick Start Guide')).toBeTruthy();
  });

  it('renders the logged-in NaliBase world hub after onboarding', async () => {
    mockAuthState.current = {
      user: {
        id: 'user-1',
        display_name: 'Fresh',
        full_name: 'Fresh User',
        onboarding_completed: true,
        welcome_tour_completed: true,
      },
      isAuthenticated: true,
      authChecked: true,
      logout: vi.fn(),
    };

    renderWithProviders(<Home />);

    expect(screen.getByText('NaliBase')).toBeTruthy();
    expect(screen.getByText('Where do you want to go?')).toBeTruthy();
    expect(screen.getByText('CONNECT').closest('a')?.getAttribute('href')).toBe('/world/connect');
    expect(screen.getByText('CREATE').closest('a')?.getAttribute('href')).toBe('/world/create');
    expect(screen.getByText('DISCOVER').closest('a')?.getAttribute('href')).toBe('/world/discover');
    expect(screen.getByText('SHARE').closest('a')?.getAttribute('href')).toBe('/world/share');
    expect(screen.getByText('VISUALIZE').closest('a')?.getAttribute('href')).toBe('/world/visualize');
    expect(screen.getByText('COMPETE').closest('a')?.getAttribute('href')).toBe('/world/compete');
  }, 15000);

  it('shows visible desktop login and signup entry points for anonymous users', async () => {
    renderWithProviders(<DesktopNav />);

    expect(screen.getByRole('link', { name: 'Log in' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign up' })).toBeTruthy();
  });

  it('restores the last mobile tab path when switching tabs', async () => {
    const firstRender = renderWithProviders(<MobileNavHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Profile' }));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/profile'));

    fireEvent.click(screen.getByRole('button', { name: 'Go profile detail' }));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/profile?id=42'));

    fireEvent.click(screen.getByRole('button', { name: 'Explore' }));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/explore'));

    fireEvent.click(screen.getByRole('button', { name: 'Profile' }));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/profile?id=42'));

    firstRender.unmount();

    renderWithProviders(<MobileNavHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Profile' }));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/profile?id=42'));
  });

  it('shows the mobile header menu and anonymous login affordance', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/" element={<MobileHeader />} />
      </Routes>
    );

    expect(screen.getAllByRole('button', { name: /Log in/i }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByText('Explore')).toBeTruthy();
    expect(screen.getByText('Studio')).toBeTruthy();
  });

  it('completes the welcome tour and navigates to challenges', async () => {
    mockAuthState.current = {
      user: { id: 'user-1' },
      isAuthenticated: true,
      logout: vi.fn(),
    };
    mockBase44.functions.invoke.mockResolvedValueOnce({
      data: {
        success: true,
        action: 'update_my_profile',
        userId: 'user-1',
        updatedFields: ['welcome_tour_completed'],
      },
    });

    renderWithProviders(
      <Routes>
        <Route path="/" element={<WelcomeTour open onClose={() => {}} />} />
        <Route path="/challenges" element={<div>Challenges Page</div>} />
      </Routes>
    );

    fireEvent.click(screen.getByRole('button', { name: /Let's Go/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: /Browse Challenges/i }));

    await screen.findByText('Challenges Page');
    expect(mockBase44.functions.invoke).toHaveBeenCalledWith('updateMyProfile', { welcome_tour_completed: true });
  });

  it('registers push support without prompting for permission automatically', async () => {
    vi.useFakeTimers();
    try {
      mockBase44.auth.me.mockResolvedValue({ id: 'user-1' });

      renderWithProviders(<NotificationBell />);

      expect(screen.getByRole('button', { name: 'Notifications' })).toBeTruthy();
      await Promise.resolve();
      expect(mockPush.registerServiceWorker).toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(3000);
      expect(mockPush.requestPushPermission).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
