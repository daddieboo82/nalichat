import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('PayPal checkout claim recycling', () => {
  it('releases claims only for agreements PayPal reports closed or absent', async () => {
    const source = await readFile('base44/functions/createPayPalSubscription/entry.ts', 'utf8');
    expect(source).toContain('releasedClaimKeys.has(previousClaim)');
    expect(source).toContain('releasedClaimKeys.add(prior.checkout_request_key)');
    expect(source).toContain("['CANCELLED', 'EXPIRED'].includes(providerStatus)");
    expect(source).toContain('remote?.custom_id !== user.id');
    expect(source).toContain('remote?.plan_id !== prior.paypal_plan_id');
    // An abandoned claim lease keeps a failed attempt from blocking checkout forever.
    expect(source).toContain('Date.now() - claimedAt > CHECKOUT_CLAIM_LEASE_MS');
    expect(source.indexOf('const reserved = await reservePayPalCheckout('))
      .toBeGreaterThan(source.indexOf("['CANCELLED', 'EXPIRED'].includes(providerStatus)"));
  });
  it('does not release uncertain claims automatically', async () => {
    const source = await readFile('base44/functions/createPayPalSubscription/entry.ts', 'utf8');
    expect(source).not.toContain('releasePayPalCheckoutClaim(');
    expect(source).toContain("PAYPAL_CHECKOUT_UNCERTAIN");
    expect(source).toContain('persisted?.paypal_checkout_claim_id === claimId');
  });
});