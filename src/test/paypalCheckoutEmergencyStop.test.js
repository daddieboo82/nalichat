import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const load = () => readFile('base44/functions/createPayPalSubscription/entry.ts', 'utf8');

describe('PayPal emergency checkout safety stop (#1048)', () => {
  it('fails closed before reading subscriptions or creating PayPal agreements', async () => {
    const code = await load();
    const functionStart = code.indexOf('function atomicCheckoutReservationIsImplemented(): boolean');
    const hardFalse = code.indexOf('return false;', functionStart);
    const gate = code.indexOf('if (!atomicCheckoutReservationIsImplemented())');
    const firstSubscriptionRead = code.indexOf('const allSubs = await');
    const providerCreate = code.indexOf("fetch(apiBase() + '/v1/billing/subscriptions', {");
    expect(functionStart).toBeGreaterThanOrEqual(0);
    expect(hardFalse).toBeGreaterThan(functionStart);
    expect(hardFalse).toBeLessThan(gate);
    expect(gate).toBeLessThan(firstSubscriptionRead);
    expect(firstSubscriptionRead).toBeLessThan(providerCreate);
    expect(code.slice(gate, firstSubscriptionRead)).toContain('status: 503');
    expect(code.slice(gate, firstSubscriptionRead)).toContain('temporarily unavailable');
  });

  it('cannot be enabled through the legacy operator secret', async () => {
    const code = await load();
    expect(code).not.toContain('PAYPAL_CHECKOUT_SERIALIZATION_VERIFIED');
    expect(code).toContain('function atomicCheckoutReservationIsImplemented(): boolean {\n  return false;\n}');
  });

  it('leaves existing subscription status and webhook code out of hotfix scope', async () => {
    const [pricing, subscriptionBilling] = await Promise.all([
      readFile('src/components/pricing/PricingPlans.jsx', 'utf8'),
      readFile('src/lib/subscriptionBilling.js', 'utf8'),
    ]);
    expect(pricing).toContain('toast.error(checkoutError?.message');
    expect(pricing).toContain('setStartingPlan(null)');
    expect(subscriptionBilling).toContain('startSubscriptionCheckout');
    expect(subscriptionBilling).toContain('payload?.error');
  });
});
