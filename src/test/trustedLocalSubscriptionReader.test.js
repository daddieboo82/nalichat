import { describe, expect, it, vi } from 'vitest';
import { createTrustedLocalSubscriptionReader } from '@/lib/trustedLocalSubscriptionReader';

const intent = {
  intentId: 'intent-1234',
  accountId: 'account-1234',
  provider: 'paypal',
  sku: 'premium_monthly',
  requestKey: 'client-request-key-1234',
  providerRequestId: 'provider-request-key-1234',
  providerId: 'I-PROVIDERSUB12345',
};
const record = {
  id: 'persisted-subscription-1',
  user_id: intent.accountId,
  provider: intent.provider,
  sku: intent.sku,
  subscription_id: intent.providerId,
  checkout_intent_id: intent.intentId,
  checkout_request_key: intent.requestKey,
  checkout_provider_request_id: intent.providerRequestId,
  status: 'pending',
};

describe('draft server-only local Subscription verification reader', () => {
  it('requires a trusted backend read function', () => {
    expect(() => createTrustedLocalSubscriptionReader({}))
      .toThrow('Trusted local Subscription database reader unavailable');
  });

  it('reads exactly one persisted subscription by customer, provider, and agreement', async () => {
    const read = vi.fn().mockResolvedValue([record]);
    const verify = createTrustedLocalSubscriptionReader({ fetchSubscriptions: read });
    const receipt = await verify(intent);
    expect(receipt).toEqual({
      verified: true, intentId: intent.intentId, accountId: intent.accountId,
      provider: intent.provider, sku: intent.sku, requestKey: intent.requestKey,
      providerRequestId: intent.providerRequestId, providerId: intent.providerId,
    });
    expect(read).toHaveBeenCalledExactlyOnceWith({
      user_id: intent.accountId,
      provider: intent.provider,
      subscription_id: intent.providerId,
    }, '-created_date', 2);
  });

  it('rejects absent, duplicated, malformed and unbound legacy rows', async () => {
    for (const rows of [
      [], [record, record], null, [{ ...record, checkout_intent_id: undefined }],
      [{ ...record, checkout_request_key: undefined }],
      [{ ...record, checkout_provider_request_id: undefined }],
      [{ ...record, checkout_request_key: 'another-valid-client-key-1234' }],
      [{ ...record, user_id: 'other-user' }],
      [{ ...record, provider: 'wix' }],
      [{ ...record, sku: 'premium_plus_monthly' }],
      [{ ...record, subscription_id: 'I-OTHERAGREEMENT1234' }],
      [{ ...record, id: undefined }],
    ]) {
      const verify = createTrustedLocalSubscriptionReader({
        fetchSubscriptions: async () => rows,
      });
      await expect(verify(intent)).rejects.toThrow();
    }
  });

  it('uses Wix checkout_id rather than PayPal subscription_id', async () => {
    const wixIntent = { ...intent, provider: 'wix', providerId: 'wix-session-123456' };
    const read = vi.fn().mockResolvedValue([{
      ...record, provider: 'wix', checkout_id: wixIntent.providerId,
    }]);
    const verify = createTrustedLocalSubscriptionReader({ fetchSubscriptions: read });
    const result = await verify(wixIntent);
    expect(result.provider).toBe('wix');
    expect(read).toHaveBeenCalledExactlyOnceWith({
      user_id: intent.accountId, provider: 'wix',
      checkout_id: wixIntent.providerId,
    }, '-created_date', 2);
  });

  it('rejects malformed intent before querying Base44', async () => {
    const read = vi.fn();
    const verify = createTrustedLocalSubscriptionReader({ fetchSubscriptions: read });
    for (const invalid of [
      null, { ...intent, accountId: '' },
      { ...intent, providerId: null },
      { ...intent, requestKey: 'short' },
      { ...intent, provider: 'unknown' },
      { ...intent, sku: 'unknown_plan' },
    ]) {
      await expect(verify(invalid)).rejects.toThrow('Local subscription verification intent invalid');
    }
    expect(read).not.toHaveBeenCalled();
  });
});
