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
  state: 'reserved', fencing_version: 1, ...changes,
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

  it('requires a version-and-state matched atomic update', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [row({ state: 'provider_request_started', fencing_version: '2' })] });
    const adapter = createPostgresCheckoutReservationAdapter(query);
    const reservation = {
      intentId: 'reserved-1', accountId: request.accountId,
      state: 'reserved', version: 1,
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
