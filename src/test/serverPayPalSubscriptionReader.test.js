import { describe, expect, it, vi } from 'vitest';
import { createServerPayPalSubscriptionReader } from '@/lib/serverPayPalSubscriptionReader';
import { verifyPayPalTerminalCheckout } from '@/lib/checkoutProviderTerminalVerification';

const intent = {
  intentId: 'draft-reservation', accountId: 'account-1', provider: 'paypal',
  providerRequestId: 'stable-provider-request-1', providerId: 'I-MOCKSUBSCRIPTION1234',
  sku: 'premium_monthly',
};
const response = (payload, ok = true) => ({ ok, json: async () => payload });
const setup = (calls) => createServerPayPalSubscriptionReader({
  environment: 'sandbox',
  clientId: 'mock-client-id', clientSecret: 'mock-secret',
  encodeBasic: (value) => 'encoded:' + value,
  fetchImpl: async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/v1/oauth2/token')) return response({ access_token: 'mock-access-token' });
    return response({ id: intent.providerId, status: 'EXPIRED',
      custom_id: intent.accountId + ':' + intent.sku, plan_id: 'P-MOCKPLAN123' });
  },
});

describe('server-only PayPal read adapter (all HTTP mocked)', () => {
  it('uses sandbox OAuth and authenticated GET; does not mutate provider state', async () => {
    const calls = [];
    const read = setup(calls);
    const proof = await verifyPayPalTerminalCheckout(intent, read);
    expect(proof.verified).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe('https://api-m.sandbox.paypal.com/v1/oauth2/token');
    expect(calls[0].options.method).toBe('POST');
    expect(calls[1].url).toBe(
      'https://api-m.sandbox.paypal.com/v1/billing/subscriptions/' + intent.providerId,
    );
    expect(calls[1].options.method).toBe('GET');
    expect(calls[1].options.headers.Authorization).toBe('Bearer mock-access-token');
  });

  it('rejects unspecified environment or missing credentials before network', () => {
    const fetchImpl = vi.fn();
    expect(() => createServerPayPalSubscriptionReader({
      environment: 'production', clientId: 'x', clientSecret: 'secret',
      fetchImpl, encodeBasic: (x) => x,
    })).toThrow();
    expect(() => createServerPayPalSubscriptionReader({
      environment: 'sandbox', clientId: 'x', clientSecret: '',
      fetchImpl, encodeBasic: (x) => x,
    })).toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects invalid provider IDs without any network request', async () => {
    const calls = [];
    await expect(setup(calls)('../other')).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });

  it('fails closed for OAuth, GET, and identity mismatches', async () => {
    const cases = [
      [response({}, false), null], [response({}), null],
      [response({ access_token: 'token' }), response({}, false)],
      [response({ access_token: 'token' }), response({ id: 'I-WRONG', status: 'EXPIRED' })],
      [response({ access_token: 'token' }), response({ id: intent.providerId, status: '' })],
      [response({ access_token: 'token' }), response({
        id: intent.providerId, status: 'EXPIRED', plan_id: 'P-MOCKPLAN123',
      })],
      [response({ access_token: 'token' }), response({
        id: intent.providerId, status: 'EXPIRED',
        custom_id: intent.accountId + ':' + intent.sku,
      })],
    ];
    for (const [auth, read] of cases) {
      let index = 0;
      const client = createServerPayPalSubscriptionReader({
        environment: 'sandbox', clientId: 'x', clientSecret: 'y',
        encodeBasic: (x) => x,
        fetchImpl: async () => (++index === 1 ? auth : read),
      });
      await expect(client(intent.providerId)).rejects.toThrow();
    }
  });

  it('never releases reservation for cancelled status even when PayPal read succeeds', async () => {
    const reader = createServerPayPalSubscriptionReader({
      environment: 'sandbox', clientId: 'x', clientSecret: 'y',
      encodeBasic: (x) => x,
      fetchImpl: async (url) => url.endsWith('/token')
        ? response({ access_token: 'token' })
        : response({ id: intent.providerId, status: 'CANCELLED',
          custom_id: intent.accountId + ':' + intent.sku, plan_id: 'P-MOCKPLAN123' }),
    });
    await expect(verifyPayPalTerminalCheckout(intent, reader)).rejects.toThrow();
  });
});
