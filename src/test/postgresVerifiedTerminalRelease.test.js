import { describe, expect, it, vi } from 'vitest';
import { createPostgresCheckoutReservationAdapter } from '@/lib/postgresCheckoutReservationAdapter';
import { advanceCheckoutIntent } from '@/lib/checkoutReservationCoordinator';

const intent = {
  intentId: 'intent-1234', accountId: 'account-1234', provider: 'paypal',
  sku: 'premium_monthly', requestKey: 'client-request-12345678',
  providerRequestId: 'provider-request-12345678',
  providerId: 'I-MOCKSUBSCRIPTION123', state: 'local_record_failed', version: 4,
};
const proof = {
  verified: true, terminal: true, intentId: intent.intentId,
  accountId: intent.accountId, provider: intent.provider,
  providerRequestId: intent.providerRequestId,
};
const row = (changes = {}) => ({
  intent_id: intent.intentId, account_id: intent.accountId,
  provider: intent.provider, sku: intent.sku,
  client_idempotency_key: intent.requestKey,
  provider_request_id: intent.providerRequestId,
  provider_id: intent.providerId, state: 'verified_terminal',
  fencing_version: '5', ...changes,
});

describe('draft PostgreSQL terminal release (mock SQL, not actual Postgres)', () => {
  it('does not call SQL when authenticated terminal verifier is absent', async () => {
    const query = vi.fn();
    const adapter = createPostgresCheckoutReservationAdapter(query);
    await expect(advanceCheckoutIntent(adapter, intent, 'verified_terminal'))
      .rejects.toThrow('Trusted terminal provider verification unavailable');
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects unverified and mismatched evidence without any write', async () => {
    for (const evidence of [
      null, { ...proof, verified: false }, { ...proof, terminal: false },
      { ...proof, accountId: 'other-account' },
      { ...proof, providerRequestId: 'different-provider-request' },
      { ...proof, provider: 'wix' },
      { ...proof, intentId: 'other-intent' },
    ]) {
      const query = vi.fn();
      const adapter = createPostgresCheckoutReservationAdapter(query, {
        verifyTerminalOutcome: async () => evidence,
      });
      await expect(advanceCheckoutIntent(adapter, intent, 'verified_terminal'))
        .rejects.toThrow('Terminal provider outcome unverified');
      expect(query).not.toHaveBeenCalled();
    }
  });

  it('rejects missing provider identity before verification', async () => {
    const query = vi.fn();
    const verify = vi.fn();
    const adapter = createPostgresCheckoutReservationAdapter(query, {
      verifyTerminalOutcome: verify,
    });
    await expect(advanceCheckoutIntent(adapter, { ...intent, providerId: null }, 'verified_terminal'))
      .rejects.toThrow('Terminal release requires a persisted provider agreement');
    expect(verify).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it('binds original agreement and fencing token during a verified release', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [row()] });
    const adapter = createPostgresCheckoutReservationAdapter(query, {
      verifyTerminalOutcome: async () => proof,
    });
    const result = await advanceCheckoutIntent(adapter, intent, 'verified_terminal');
    expect(result.state).toBe('verified_terminal');
    expect(result.version).toBe(5);
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, args] = query.mock.calls[0];
    expect(sql).toContain("set state = 'verified_terminal'");
    expect(sql).toContain('provider_id = $7');
    expect(sql).toContain('state = $8 and fencing_version = $9');
    expect(args).toEqual([
      intent.intentId, intent.accountId, intent.provider, intent.sku,
      intent.requestKey, intent.providerRequestId, intent.providerId,
      intent.state, intent.version,
    ]);
  });

  it('rejects stale or mismatched database release proof', async () => {
    for (const rows of [
      [], [row({ provider_id: 'I-OTHERAGREEMENT123' })],
      [row({ account_id: 'other-account' })],
      [row({ fencing_version: '6' })],
      [row({ state: 'local_record_failed' })],
    ]) {
      const adapter = createPostgresCheckoutReservationAdapter(async () => ({ rows }), {
        verifyTerminalOutcome: async () => proof,
      });
      await expect(advanceCheckoutIntent(adapter, intent, 'verified_terminal')).rejects.toThrow();
    }
  });

  it('never enables generic terminal release even when terminal verifier exists', async () => {
    const query = vi.fn();
    const adapter = createPostgresCheckoutReservationAdapter(query, {
      verifyTerminalOutcome: async () => proof,
    });
    await expect(adapter.compareAndSwap({
      intentId: intent.intentId, accountId: intent.accountId,
      expectedState: intent.state, expectedVersion: intent.version,
      nextState: 'verified_terminal',
    })).rejects.toThrow('Verified terminal release store unavailable');
    expect(query).not.toHaveBeenCalled();
  });
});
