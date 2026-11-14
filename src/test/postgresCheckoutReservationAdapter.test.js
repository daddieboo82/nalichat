import { describe, expect, it, vi } from 'vitest';
import { createPostgresCheckoutReservationAdapter } from '@/lib/postgresCheckoutReservationAdapter';
import { claimCheckoutIntent, advanceCheckoutIntent } from '@/lib/checkoutReservationCoordinator';

const request = {
  accountId: 'account-one', provider: 'paypal', sku: 'premium_monthly',
  requestKey: 'stable-request-key-001', providerRequestId: 'stable-provider-id-001',
};
const row = (changes = {}) => ({
  intent_id: 'reserved-1', account_id: request.accountId, provider: request.provider,
  sku: request.sku, client_idempotency_key: request.requestKey,
  provider_request_id: request.providerRequestId,
  provider_id: null, state: 'reserved', fencing_version: 1, ...changes,
});
describe('draft PostgreSQL checkout adapter (mock SQL, not a DB test)', () => {
  it('uses one parameterized insert before reading conflicting rows', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [row()] });
    const adapter = createPostgresCheckoutReservationAdapter(query);
    const claimed = await claimCheckoutIntent(adapter, request);
    expect(claimed.kind).toBe('created');
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, values] = query.mock.calls[0];
    expect(sql).toMatch(/insert into billing_private.checkout_intents/);
    expect(sql).toContain('on conflict do nothing');
    expect(sql).toContain('returning intent_id');
    expect(values).toEqual([
      request.accountId, request.provider, request.sku,
      request.requestKey, request.providerRequestId,
    ]);
    expect(sql).not.toContain(request.accountId);
    expect(sql).not.toContain(request.requestKey);
  });

  it('never creates a second intent after a conflict or terminal replay', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [row()] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [row({ state: 'verified_terminal' })] });
    const adapter = createPostgresCheckoutReservationAdapter(query);
    expect((await claimCheckoutIntent(adapter, request)).kind).toBe('existing');
    expect((await claimCheckoutIntent(adapter, request)).kind).toBe('conflict');
    expect(query).toHaveBeenCalledTimes(4);
  });

  it('fails closed on missing DB, ambiguous or invalid reservation proof', async () => {
    expect(() => createPostgresCheckoutReservationAdapter(null)).toThrow();
    const missing = createPostgresCheckoutReservationAdapter(async () => {
      throw new Error('DB unavailable');
    });
    await expect(claimCheckoutIntent(missing, request)).rejects.toThrow('DB unavailable');
    const malformed = createPostgresCheckoutReservationAdapter(async () => ({ rows: [row({ account_id: 'another-account' })] }));
    await expect(claimCheckoutIntent(malformed, request)).rejects.toThrow('Reservation proof invalid');
    const duplicate = createPostgresCheckoutReservationAdapter(async () => ({ rows: [row(), row()] }));
    await expect(claimCheckoutIntent(duplicate, request)).rejects.toThrow();
  });

  it('rejects precision-losing Postgres bigint and malformed database identities', async () => {
    const values = [
      '9007199254740993', '0', '-1', '1.5', 'not-a-version', null,
      Number.MAX_SAFE_INTEGER + 1,
    ];
    for (const fencing_version of values) {
      const adapter = createPostgresCheckoutReservationAdapter(
        async () => ({ rows: [row({ fencing_version })] }),
      );
      await expect(claimCheckoutIntent(adapter, request)).rejects.toThrow();
    }
    const invalidIdentity = createPostgresCheckoutReservationAdapter(
      async () => ({ rows: [row({ intent_id: null })] }),
    );
    await expect(claimCheckoutIntent(invalidIdentity, request)).rejects.toThrow();
  });

  it('rejects malformed persisted provider and checkout identities instead of coercing to null', async () => {
    for (const changes of [
      { provider_id: '' },
      { provider_id: '../malformed' },
      { provider_id: undefined },
      { provider_id: 1234 },
      { state: 'provider_created', provider_id: null },
      { state: 'local_recorded', provider_id: null },
      { provider: 'unexpected-provider' },
      { sku: 'unknown_plan' },
      { provider_request_id: '' },
      { client_idempotency_key: '' },
      { state: 'bogus' },
    ]) {
      const adapter = createPostgresCheckoutReservationAdapter(
        async () => ({ rows: [row(changes)] }),
      );
      await expect(claimCheckoutIntent(adapter, request)).rejects.toThrow(
        'Malformed PostgreSQL checkout reservation identity',
      );
    }
  });

  it('maps provider subscription identity only from persisted database rows', async () => {
    const providerId = 'I-MOCKSUBSCRIPTION123';
    const adapter = createPostgresCheckoutReservationAdapter(
      async () => ({ rows: [row({ provider_id: providerId })] }),
    );
    const result = await claimCheckoutIntent(adapter, request);
    expect(result.intent.providerId).toBe(providerId);
    const absent = createPostgresCheckoutReservationAdapter(
      async () => ({ rows: [row()] }),
    );
    expect((await claimCheckoutIntent(absent, request)).intent.providerId).toBeNull();
  });

  it('records verified provider ID only with version-bound state transition', async () => {
    const providerId = 'I-MOCKSUBSCRIPTION123';
    const query = vi.fn().mockResolvedValue({ rows: [row({
      state: 'provider_created', provider_id: providerId, fencing_version: '3',
    })] });
    const adapter = createPostgresCheckoutReservationAdapter(query);
    const stored = await adapter.recordProviderSubscription({
      intentId: 'reserved-1', accountId: request.accountId, provider: 'paypal',
      sku: request.sku, providerRequestId: request.providerRequestId,
      expectedState: 'provider_outcome_unknown', expectedVersion: 2, providerId,
    });
    expect(stored.providerId).toBe(providerId);
    expect(stored.state).toBe('provider_created');
    expect(stored.version).toBe(3);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('provider_id is null');
    expect(query.mock.calls[0][0]).toContain('fencing_version = $5');
    expect(query.mock.calls[0][0]).toContain('sku = $7');
    expect(query.mock.calls[0][0]).toContain('provider_request_id = $8');
    expect(query.mock.calls[0][1]).toEqual([
      'reserved-1', request.accountId, 'paypal',
      'provider_outcome_unknown', 2, providerId,
      request.sku, request.providerRequestId,
    ]);
    const stale = createPostgresCheckoutReservationAdapter(async () => ({ rows: [] }));
    expect(await stale.recordProviderSubscription({
      intentId: 'reserved-1', accountId: request.accountId, provider: 'paypal',
      sku: request.sku, providerRequestId: request.providerRequestId,
      expectedState: 'provider_outcome_unknown', expectedVersion: 2, providerId,
    })).toBeNull();
    const invalid = createPostgresCheckoutReservationAdapter(query);
    await expect(invalid.recordProviderSubscription({
      intentId: 'reserved-1', accountId: request.accountId, provider: 'paypal',
      sku: request.sku, providerRequestId: request.providerRequestId,
      expectedState: 'reserved', expectedVersion: 1, providerId,
    })).rejects.toThrow();
    await expect(invalid.recordProviderSubscription({
      intentId: 'reserved-1', accountId: request.accountId, provider: 'paypal',
      sku: request.sku, providerRequestId: request.providerRequestId,
      expectedState: 'provider_request_started', expectedVersion: 1, providerId: '../bad-id',
    })).rejects.toThrow();
    expect(query).toHaveBeenCalledTimes(1);
    for (const mismatch of [
      { provider_id: 'I-INCORRECT1234567' },
      { account_id: 'other-account' },
      { state: 'reserved' },
      { fencing_version: '4' },
      { sku: 'premium_plus_monthly' },
      { provider_request_id: 'different-request-12345678' },
    ]) {
      const mismatched = createPostgresCheckoutReservationAdapter(
        async () => ({ rows: [row({
          state: 'provider_created', provider_id: providerId, fencing_version: '3', ...mismatch,
        })] }),
      );
      await expect(mismatched.recordProviderSubscription({
        intentId: 'reserved-1', accountId: request.accountId, provider: 'paypal',
      sku: request.sku, providerRequestId: request.providerRequestId,
        expectedState: 'provider_outcome_unknown', expectedVersion: 2, providerId,
      })).rejects.toThrow('Provider identity recording proof invalid');
    }
  });

  it('does not let generic CAS release an account without a dedicated verified release', async () => {
    const query = vi.fn();
    const adapter = createPostgresCheckoutReservationAdapter(query);
    await expect(adapter.compareAndSwap({
      intentId: 'reserved-1', accountId: request.accountId,
      expectedState: 'local_recorded', expectedVersion: 5,
      nextState: 'verified_terminal',
    })).rejects.toThrow('Verified terminal release store unavailable');
    await expect(adapter.compareAndSwap({
      intentId: 'reserved-1', accountId: request.accountId,
      expectedState: 'provider_request_started', expectedVersion: 2,
      nextState: 'provider_created',
    })).rejects.toThrow('Provider identity must be durably recorded');
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects forbidden generic state transitions before issuing SQL', async () => {
    const query = vi.fn();
    const adapter = createPostgresCheckoutReservationAdapter(query);
    for (const [expectedState, nextState] of [
      ['reserved', 'local_recorded'],
      ['provider_outcome_unknown', 'local_recorded'],
      ['local_recorded', 'reserved'],
      ['verified_terminal', 'provider_request_started'],
      ['provider_created', 'provider_outcome_unknown'],
      ['provider_created', 'local_recorded'],
      ['local_record_failed', 'local_recorded'],
      ['nonexistent', 'local_recorded'],
    ]) {
      await expect(adapter.compareAndSwap({
        intentId: 'reserved-1', accountId: request.accountId,
        expectedState, expectedVersion: 2, nextState,
      })).rejects.toThrow('Invalid checkout state transition');
    }
    await expect(adapter.compareAndSwap({
      intentId: 'reserved-1', accountId: request.accountId,
      expectedState: 'reserved', expectedVersion: Number.MAX_SAFE_INTEGER + 1,
      nextState: 'provider_request_started',
    })).rejects.toThrow('Invalid checkout state transition');
    expect(query).not.toHaveBeenCalled();
  });

  it('requires a version-and-state matched atomic update', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [row({ state: 'provider_request_started', fencing_version: '2' })] });
    const adapter = createPostgresCheckoutReservationAdapter(query);
    const reservation = {
      intentId: 'reserved-1', accountId: request.accountId,
      provider: request.provider, sku: request.sku,
      requestKey: request.requestKey, providerRequestId: request.providerRequestId,
      providerId: null, state: 'reserved', version: 1,
    };
    const updated = await advanceCheckoutIntent(adapter, reservation, 'provider_request_started');
    expect(updated.version).toBe(2);
    expect(query.mock.calls[0][0]).toContain('fencing_version = $4');
    expect(query.mock.calls[0][1]).toEqual([
      reservation.intentId, reservation.accountId, 'reserved', 1, 'provider_request_started',
    ]);
    const stale = createPostgresCheckoutReservationAdapter(async () => ({ rows: [] }));
    await expect(advanceCheckoutIntent(stale, reservation, 'provider_request_started')).rejects.toThrow();
  });
});
