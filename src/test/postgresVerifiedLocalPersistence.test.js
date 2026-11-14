import { describe, expect, it, vi } from 'vitest';
import { createPostgresCheckoutReservationAdapter } from '@/lib/postgresCheckoutReservationAdapter';
import { confirmVerifiedLocalSubscription } from '@/lib/checkoutReservationCoordinator';

const intent = {
  intentId: 'intent-123', accountId: 'account-123',
  provider: 'paypal', sku: 'premium_monthly',
  requestKey: 'request-key-1234567890',
  providerRequestId: 'provider-request-1234567890',
  providerId: 'I-PROVIDER12345678', state: 'local_record_failed', version: 5,
};
const receipt = {
  verified: true, intentId: intent.intentId, accountId: intent.accountId,
  requestKey: intent.requestKey, provider: intent.provider, sku: intent.sku,
  providerRequestId: intent.providerRequestId, providerId: intent.providerId,
};
const persisted = {
  intent_id: intent.intentId, account_id: intent.accountId,
  provider: intent.provider, sku: intent.sku,
  client_idempotency_key: intent.requestKey,
  provider_request_id: intent.providerRequestId,
  provider_id: intent.providerId, state: 'local_recorded', fencing_version: '6',
};

describe('draft local Subscription persistence confirmation (mock SQL only)', () => {
  it('fails closed when there is no trusted persisted-record reader', async () => {
    const query = vi.fn();
    const adapter = createPostgresCheckoutReservationAdapter(query);
    await expect(confirmVerifiedLocalSubscription(adapter, intent))
      .rejects.toThrow('Trusted local subscription verification unavailable');
    expect(query).not.toHaveBeenCalled();
  });

  it('does not write when the durable-record receipt is missing or mismatched', async () => {
    for (const proof of [
      null, { ...receipt, verified: false },
      { ...receipt, accountId: 'other-account' },
      { ...receipt, requestKey: 'another-client-request-12345' },
      { ...receipt, sku: 'premium_plus_monthly' },
      { ...receipt, providerRequestId: 'other-provider-request' },
      { ...receipt, providerId: 'I-OTHERAGREEMENT123' },
    ]) {
      const query = vi.fn();
      const adapter = createPostgresCheckoutReservationAdapter(query, {
        verifyPersistedSubscription: async () => proof,
      });
      await expect(confirmVerifiedLocalSubscription(adapter, intent))
        .rejects.toThrow('Durable local subscription receipt unverified');
      expect(query).not.toHaveBeenCalled();
    }
  });

  it('confirms a matching persisted agreement with state-and-version fencing', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [persisted] });
    const adapter = createPostgresCheckoutReservationAdapter(query, {
      verifyPersistedSubscription: async () => receipt,
    });
    const result = await confirmVerifiedLocalSubscription(adapter, intent);
    expect(result.state).toBe('local_recorded');
    expect(result.providerId).toBe(intent.providerId);
    expect(result.version).toBe(6);
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, args] = query.mock.calls[0];
    expect(sql).toContain("set state = 'local_recorded'");
    expect(sql).toContain('provider_id = $7');
    expect(sql).toContain('state = $8 and fencing_version = $9');
    expect(args).toEqual([
      intent.intentId, intent.accountId, intent.provider, intent.sku,
      intent.requestKey, intent.providerRequestId, intent.providerId,
      intent.state, intent.version,
    ]);
  });

  it('rejects stale or mismatched persistence results', async () => {
    for (const rows of [
      [], [{ ...persisted, provider_id: 'I-WRONG1234567' }],
      [{ ...persisted, account_id: 'other-account' }],
      [{ ...persisted, sku: 'premium_plus_monthly' }],
      [{ ...persisted, fencing_version: '7' }],
    ]) {
      const adapter = createPostgresCheckoutReservationAdapter(
        async () => ({ rows }),
        { verifyPersistedSubscription: async () => receipt },
      );
      await expect(confirmVerifiedLocalSubscription(adapter, intent)).rejects.toThrow();
    }
  });

  it('rejects a missing provider agreement before any local lookup', async () => {
    const query = vi.fn();
    const read = vi.fn();
    const adapter = createPostgresCheckoutReservationAdapter(query, {
      verifyPersistedSubscription: read,
    });
    await expect(confirmVerifiedLocalSubscription(adapter, {
      ...intent, providerId: null,
    })).rejects.toThrow('Verified local record requires persisted provider identity');
    expect(read).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
});
