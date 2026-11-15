import { describe, expect, it, vi } from 'vitest';
import { createTrustedPayPalTerminalVerifier } from '@/lib/trustedPayPalTerminalVerifier';

const intent = {
  intentId: 'intent-1', accountId: 'account-123', provider: 'paypal',
  sku: 'premium_monthly', requestKey: 'original-client-request-key-1234',
  providerRequestId: 'original-provider-request-1',
  providerId: 'I-MOCKSUBSCRIPTION1234',
};
const plans = {
  PAYPAL_PREMIUM_MONTHLY_PLAN_ID: 'P-MOCKMONTHLY123',
  PAYPAL_PREMIUM_YEARLY_PLAN_ID: 'P-MOCKYEARLY1234',
  PAYPAL_PREMIUM_PLUS_MONTHLY_PLAN_ID: 'P-MOCKPLUSMONTH123',
  PAYPAL_PREMIUM_PLUS_YEARLY_PLAN_ID: 'P-MOCKPLUSYEAR1234',
};

describe('draft private PayPal plan binding (mock only)', () => {
  const remote = (i, plan) => ({
    id: i.providerId, status: 'EXPIRED',
    custom_id: i.accountId + ':' + i.sku, plan_id: plan,
  });

  it('uses the correct private secret for each supported SKU', async () => {
    for (const sku of [
      'premium_monthly', 'premium_yearly',
      'premium_plus_monthly', 'premium_plus_yearly',
    ]) {
      const getSecret = vi.fn((key) => plans[key]);
      const readSubscription = vi.fn(async () =>
        remote({ ...intent, sku }, plans[{
          premium_monthly: 'PAYPAL_PREMIUM_MONTHLY_PLAN_ID',
          premium_yearly: 'PAYPAL_PREMIUM_YEARLY_PLAN_ID',
          premium_plus_monthly: 'PAYPAL_PREMIUM_PLUS_MONTHLY_PLAN_ID',
          premium_plus_yearly: 'PAYPAL_PREMIUM_PLUS_YEARLY_PLAN_ID',
        }[sku]]));
      const verify = createTrustedPayPalTerminalVerifier({
        getSecret, readSubscription,
      });
      expect((await verify({ ...intent, sku })).verified).toBe(true);
      expect(getSecret).toHaveBeenCalledTimes(1);
      expect(readSubscription).toHaveBeenCalledExactlyOnceWith(intent.providerId);
    }
  });

  it('fails closed for wrong plan, missing config and unsupported SKU', async () => {
    const readSubscription = vi.fn(async () => remote(intent, plans.PAYPAL_PREMIUM_MONTHLY_PLAN_ID));
    const badConfig = createTrustedPayPalTerminalVerifier({
      getSecret: () => undefined, readSubscription,
    });
    await expect(badConfig(intent)).rejects.toThrow();
    expect(readSubscription).not.toHaveBeenCalled();
    const wrongPlan = createTrustedPayPalTerminalVerifier({
      getSecret: () => 'P-DIFFERENT1234', readSubscription,
    });
    await expect(wrongPlan(intent)).rejects.toThrow();
    const supported = createTrustedPayPalTerminalVerifier({
      getSecret: (key) => plans[key], readSubscription,
    });
    await expect(supported({ ...intent, sku: '__proto__' })).rejects.toThrow();
    await expect(supported({ ...intent, provider: 'wix' })).rejects.toThrow();
  });

  it('requires trusted backend dependencies and never accepts client plan override', async () => {
    expect(() => createTrustedPayPalTerminalVerifier({})).toThrow();
    const verify = createTrustedPayPalTerminalVerifier({
      getSecret: (key) => plans[key],
      readSubscription: async () => remote(intent, plans.PAYPAL_PREMIUM_MONTHLY_PLAN_ID),
    });
    expect((await verify({ ...intent, expectedPlanId: 'P-ATTACKER1234' })).verified).toBe(true);
  });
});
