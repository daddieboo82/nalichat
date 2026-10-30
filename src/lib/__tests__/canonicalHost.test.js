import { describe, expect, it, vi } from 'vitest';
import { legacyHostRedirectTarget, redirectLegacyHost } from '@/lib/canonicalHost';

describe('canonical host redirect', () => {
  it('sends the old website to nalichat.org and keeps the PayPal return query', () => {
    expect(legacyHostRedirectTarget(
      'https://nalichat.base44.app/ThankYou?subscription=1&subscription_id=I-TEST&ba_token=BA-TEST',
    )).toBe('https://nalichat.org/ThankYou?subscription=1&subscription_id=I-TEST&ba_token=BA-TEST');

    expect(legacyHostRedirectTarget('https://www.nalichat.org/pricing?plan=premium')).toBe(
      'https://nalichat.org/pricing?plan=premium',
    );
  });

  it('leaves the canonical site and local development hosts alone', () => {
    expect(legacyHostRedirectTarget('https://nalichat.org/pricing')).toBeNull();
    expect(legacyHostRedirectTarget('http://localhost:5173/pricing')).toBeNull();
    expect(legacyHostRedirectTarget('https://preview.base44.app/pricing')).toBeNull();
  });

  it('replaces the current location when the host is legacy', () => {
    const location = {
      href: 'https://nalichat.base44.app/messages',
      replace: vi.fn(),
    };
    expect(redirectLegacyHost(location)).toBe(true);
    expect(location.replace).toHaveBeenCalledWith('https://nalichat.org/messages');
  });
});
