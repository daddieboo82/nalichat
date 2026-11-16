import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('PayPal checkout claim recycling', () => {
  it('requires provider-verified terminal agreement linked to the prior claim', async () => {
    const source = await readFile('base44/functions/createPayPalSubscription/entry.ts', 'utf8');
    expect(source).toContain('verifiedTerminalClaimKeys.has(previousClaim)');
    expect(source).toContain('verifiedTerminalClaimKeys.add(prior.checkout_request_key)');
    expect(source).toContain("['CANCELLED', 'EXPIRED'].includes(remote?.status)");
    expect(source).toContain('remote?.custom_id !== user.id');
    expect(source).toContain('remote?.plan_id !== prior.paypal_plan_id');
    expect(source).toContain('previousDate >= new Date().toISOString().slice(0, 10)');
    expect(source.indexOf('verifiedTerminalClaimKeys.add(prior.checkout_request_key)'))
      .toBeGreaterThan(source.indexOf("['CANCELLED', 'EXPIRED'].includes(remote?.status)"));
    expect(source.indexOf('const reserved = await reservePayPalCheckout('))
      .toBeGreaterThan(source.indexOf('verifiedTerminalClaimKeys.add(prior.checkout_request_key)'));
  });
  it('does not release uncertain claims automatically', async () => {
    const source = await readFile('base44/functions/createPayPalSubscription/entry.ts', 'utf8');
    expect(source).not.toContain('releasePayPalCheckoutClaim(');
    expect(source).toContain("PAYPAL_CHECKOUT_UNCERTAIN");
    expect(source).toContain('persisted?.paypal_checkout_claim_id === claimId');
  });
});
