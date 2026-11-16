import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('PayPal checkout stale pending recovery', () => {
  it('verifies prior PayPal status instead of blocking solely on local pending', async () => {
    const src = await readFile('base44/functions/createPayPalSubscription/entry.ts', 'utf8');
    expect(src).toContain("const providerStatus = String(remote?.status || '').toUpperCase()");
    expect(src).toContain("['CANCELLED', 'EXPIRED'].includes(providerStatus)");
    expect(src).toContain("providerStatus === 'APPROVAL_PENDING'");
    expect(src).toContain("remote?.custom_id !== user.id + ':' + prior.sku");
    expect(src).toContain("remote?.plan_id !== prior.paypal_plan_id");
    expect(src).toContain("releasedClaimKeys.add(prior.checkout_request_key)");
    expect(src).not.toContain("allSubs.some((sub: any) => sub.provider === 'paypal' && sub.status === 'pending')");
    expect(src.indexOf("const providerStatus = String(remote?.status || '').toUpperCase()"))
      .toBeLessThan(src.indexOf('const reserved = await reservePayPalCheckout('));
  });
});