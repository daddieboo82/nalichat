import { describe, expect, it } from 'vitest';
import { paypalSubscriptionRequestId } from '../../base44/shared/paypalCheckoutRequest.ts';

describe('PayPal subscription checkout request IDs', () => {
  const when = new Date('2026-11-18T12:00:00Z');

  it('uses different request IDs for Premium and Premium Plus selected on the same day', async () => {
    const premium = await paypalSubscriptionRequestId('buyer-1', 'premium_monthly', when);
    const plus = await paypalSubscriptionRequestId('buyer-1', 'premium_plus_monthly', when);
    expect(premium).not.toBe(plus);
    expect(premium).toMatch(/^[a-f0-9]{36}$/);
    expect(plus).toMatch(/^[a-f0-9]{36}$/);
  });

  it('keeps repeat requests for the same account, plan and day idempotent', async () => {
    const first = await paypalSubscriptionRequestId('buyer-1', 'premium_monthly', when);
    const second = await paypalSubscriptionRequestId('buyer-1', 'premium_monthly', new Date('2026-11-18T22:00:00Z'));
    expect(first).toBe(second);
  });

  it('separates plans, buyers, billing periods and UTC days', async () => {
    const base = await paypalSubscriptionRequestId('buyer-1', 'premium_monthly', when);
    const values = await Promise.all([
      paypalSubscriptionRequestId('buyer-2', 'premium_monthly', when),
      paypalSubscriptionRequestId('buyer-1', 'premium_yearly', when),
      paypalSubscriptionRequestId('buyer-1', 'premium_monthly', new Date('2026-11-19T00:00:00Z')),
    ]);
    expect(values.every(value => value !== base)).toBe(true);
  });

  it('rejects unknown plan scopes', async () => {
    await expect(paypalSubscriptionRequestId('buyer-1', 'free', when)).rejects.toThrow('Invalid');
  });
});
