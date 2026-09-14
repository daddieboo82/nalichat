import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackPaywallEvent } from '@/lib/paywallAnalytics';

afterEach(() => {
  delete window.gtag;
});

describe('paywall campaign analytics', () => {
  it('forwards allowed non-PII campaign context to analytics', () => {
    const gtag = vi.fn();
    window.gtag = gtag;

    trackPaywallEvent('checkout_started', {
      plan: 'premium',
      campaign_source: 'google',
      campaign_medium: 'cpc',
      campaign_name: 'google_ads_campaign_2',
      campaign_term: 'music collaboration',
      google_ads_click: true,
      email: 'must-not-forward@example.com',
    });

    expect(gtag).toHaveBeenCalledWith('event', 'checkout_started', {
      plan: 'premium',
      campaign_source: 'google',
      campaign_medium: 'cpc',
      campaign_name: 'google_ads_campaign_2',
      campaign_term: 'music collaboration',
      google_ads_click: true,
    });
  });
});
