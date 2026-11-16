// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ThankYou from '@/pages/ThankYou';
import { pollForSubscriptionConfirmation } from '@/lib/subscriptionConfirmation';
import { trackPaywallEvent } from '@/lib/paywallAnalytics';

const base44 = vi.hoisted(() => ({
  functions: { invoke: vi.fn() },
  refetchSubscription: vi.fn(),
  entities: { ArtPost: { get: vi.fn() } },
}));

vi.mock('@/api/base44Client', () => ({ base44 }));
vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({ refetch: base44.refetchSubscription }),
}));
vi.mock('@/lib/subscriptionConfirmation', () => ({
  pollForSubscriptionConfirmation: vi.fn(),
}));
vi.mock('@/lib/paywallAnalytics', () => ({ trackPaywallEvent: vi.fn() }));
vi.mock('@/lib/subscriptionClient', () => ({ SUBSCRIPTION_QUERY_KEY: 'subscription' }));
vi.mock('@/lib/subscriptionBilling', () => ({
  CHECKOUT_RETURN_KEY: 'nalichat_subscription_checkout_started',
  CHECKOUT_ATTRIBUTION_KEY: 'test-checkout-attribution',
  CHECKOUT_SUBSCRIPTION_ID_KEY: 'test-paypal-agreement-id',
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
    sessionStorage.clear();
    window.scrollTo = vi.fn();
  });

  // Each case mounts a fresh page; unmount it so a previous render's links and
  // headings cannot be matched by the next case's queries.
  afterEach(() => {
    cleanup();
  });

  it('records a verification timeout separately from a confirmed purchase', async () => {
    pollForSubscriptionConfirmation.mockResolvedValue({ outcome: 'timeout' });
    sessionStorage.setItem('test-checkout-attribution', JSON.stringify({
      source: 'studio_bounce',
      feature: 'studio.ai_mastering',
      sku: 'premium_monthly',
    }));

    renderPage('/ThankYou?subscription=1');

    await waitFor(() => expect(trackPaywallEvent).toHaveBeenCalledWith(
      'purchase_failed',
      expect.objectContaining({
        outcome: 'verification_timeout',
        source: 'studio_bounce',
        upgrade_feature: 'studio.ai_mastering',
        checkout_sku: 'premium_monthly',
      }),
    ));
    expect(trackPaywallEvent).not.toHaveBeenCalledWith('purchase_completed', expect.anything());
  });

  it('routes uncertain PayPal returns to billing review instead of encouraging another checkout', async () => {
    pollForSubscriptionConfirmation.mockResolvedValue({ outcome: 'timeout' });
    renderPage('/ThankYou?subscription=1');

    expect(await screen.findByText('Still processing')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Review billing in Settings' }).getAttribute('href')).toBe('/settings');
    expect(screen.queryByRole('link', { name: 'Back to plans' })).toBeNull();
    expect(screen.getByText(/avoid a duplicate charge/)).toBeTruthy();
    expect(trackPaywallEvent).not.toHaveBeenCalledWith('purchase_completed', expect.anything());
  });

  it('does not claim a new sale when the account is paid but checkout agreement evidence is missing', async () => {
    pollForSubscriptionConfirmation.mockResolvedValue({
      outcome: 'confirmed',
      subscription: {
        hasPaidAccess: true,
        plan: 'premium',
        subscriptionRecordId: 'record-old',
        verifiedPayPalAgreementId: 'I-OLDER-PAID',
      },
    });
    renderPage('/ThankYou?subscription=1');
    expect(await screen.findByText('Your paid plan is active')).toBeTruthy();
    expect(screen.queryByText('You’re upgraded!')).toBeNull();
    expect(trackPaywallEvent).not.toHaveBeenCalledWith('purchase_completed', expect.anything());
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

  it('shows an accurate processing state for delayed donations without claiming payment', async () => {
    base44.functions.invoke.mockResolvedValue({
      data: {
        success: true,
        checkoutId: 'cs_test_123',
        status: 'pending',
        items: [{ type: 'donation', name: 'Donation to NaliBase' }],
      },
    });
    renderPage('/ThankYou?checkout_id=cs_test_123&purchase_token=secret-token');
    expect(await screen.findByText('Donation payment processing')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Check payment status again' })).toBeTruthy();
    expect(screen.queryByText('Purchase Complete!')).toBeNull();
  });

  it('shows success only after the backend confirms paid status', async () => {
    base44.functions.invoke.mockResolvedValue({
      data: {
        success: true,
        checkoutId: 'cs_test_123',
        status: 'paid',
        items: [{ type: 'donation', name: 'Donation to NaliBase' }],
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