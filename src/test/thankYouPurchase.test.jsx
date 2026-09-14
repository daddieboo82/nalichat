// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ThankYou from '@/pages/ThankYou';

const base44 = vi.hoisted(() => ({
  functions: { invoke: vi.fn() },
  entities: { ArtPost: { get: vi.fn() } },
}));

vi.mock('@/api/base44Client', () => ({ base44 }));
vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({ refetch: vi.fn() }),
}));
vi.mock('@/lib/subscriptionConfirmation', () => ({
  pollForSubscriptionConfirmation: vi.fn(),
}));
vi.mock('@/lib/paywallAnalytics', () => ({ trackPaywallEvent: vi.fn() }));
vi.mock('@/lib/subscriptionClient', () => ({ SUBSCRIPTION_QUERY_KEY: 'subscription' }));
vi.mock('@/lib/subscriptionBilling', () => ({
  CHECKOUT_RETURN_KEY: 'nalichat_subscription_checkout_started',
}));
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, { get: () => ({ children, ...props }) => <div {...props}>{children}</div> }),
}));

function renderPage(url) {
  window.history.pushState({}, '', url);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ThankYou />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ThankYou purchase verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.scrollTo = vi.fn();
  });

  it('does not show purchase complete when the return verifier is missing', async () => {
    renderPage('/ThankYou?checkout_id=cs_test_123');

    expect(await screen.findByText('Payment not verified')).toBeTruthy();
    expect(screen.queryByText('Purchase Complete!')).toBeNull();
    expect(base44.functions.invoke).not.toHaveBeenCalledWith(
      'verifyCheckoutPayment',
      expect.anything(),
    );
  });

  it('shows success only after the backend confirms paid status', async () => {
    base44.functions.invoke.mockResolvedValue({
      data: {
        success: true,
        checkoutId: 'cs_test_123',
        status: 'paid',
        items: [{ type: 'donation', name: 'Donation to NaliChat' }],
      },
    });

    renderPage('/ThankYou?checkout_id=cs_test_123&purchase_token=secret-token');

    await waitFor(() => {
      expect(base44.functions.invoke).toHaveBeenCalledWith('verifyCheckoutPayment', {
        checkoutId: 'cs_test_123',
        purchaseToken: 'secret-token',
      });
    });
    expect(await screen.findByText('Purchase Complete!')).toBeTruthy();
  });
});
