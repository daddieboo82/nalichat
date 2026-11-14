import { describe, expect, it } from 'vitest';
import { advanceCheckoutIntent, claimCheckoutIntent, recordVerifiedProviderCreation } from '@/lib/checkoutReservationCoordinator';

// Deliberately atomic fake within a single JS process. This tests the
// COORDINATOR CONTRACT only, NOT database transaction isolation.
function createFakeAtomicStore() {
  const outstanding = new Map();
  const all = new Map();
  let counter = 0;
  const calls = { provider: 0, claims: 0, cas: 0 };
  const adapter = {
    async claimAtomic(input) {
      calls.claims++;
      const previous = outstanding.get(input.accountId);
      if (previous) {
        const exact = previous.requestKey === input.requestKey &&
          previous.sku === input.sku && previous.provider === input.provider;
        return { kind: exact ? 'existing' : 'conflict', intent: { ...previous } };
      }
      const intent = {
        accountId: input.accountId, intentId: 'mock-' + (++counter),
        provider: input.provider, sku: input.sku, requestKey: input.requestKey,
        providerRequestId: input.providerRequestId,
        state: 'reserved', version: 1,
      };
      outstanding.set(input.accountId, intent);
      all.set(intent.intentId, intent);
      return { kind: 'created', intent: { ...intent } };
    },
    // Test-only trusted verification fixture. The production adapter must
    // obtain and verify provider-side terminal evidence independently.
    async verifyTerminalOutcome(intent) {
      return {
        verified: true, terminal: true, intentId: intent.intentId,
        accountId: intent.accountId, provider: intent.provider,
        providerRequestId: intent.providerRequestId,
      };
    },
    async verifyCreatedSubscription(intent) {
      return {
        verified: true, intentId: intent.intentId, accountId: intent.accountId,
        provider: intent.provider, providerRequestId: intent.providerRequestId,
        providerId: 'I-MOCKSUBSCRIPTION1234',
      };
    },
    async recordProviderSubscription({ intentId, accountId, provider, expectedState, expectedVersion, providerId }) {
      const current = all.get(intentId);
      if (!current || current.accountId !== accountId || current.provider !== provider
        || current.state !== expectedState || current.version !== expectedVersion
        || current.providerId) return null;
      const updated = { ...current, providerId, state: 'provider_created', version: current.version + 1 };
      all.set(intentId, updated);
      outstanding.set(accountId, updated);
      return { ...updated };
    },
    async compareAndSwap({ intentId, accountId, expectedState, expectedVersion, nextState }) {
      calls.cas++;
      const intent = all.get(intentId);
      if (!intent || intent.accountId !== accountId || intent.state !== expectedState
        || intent.version !== expectedVersion) return null;
      const updated = { ...intent, state: nextState, version: intent.version + 1 };
      all.set(intentId, updated);
      if (nextState === 'verified_terminal') outstanding.delete(accountId);
      else outstanding.set(accountId, updated);
      return { ...updated };
    },
  };
  return { adapter, calls, all, outstanding };
}

describe('draft checkout reservation coordinator (no provider calls)', () => {
  const input = (i, accountId = 'user-a') => ({
    accountId,
    provider: i % 2 ? 'paypal' : 'wix',
    sku: i % 3 ? 'premium_monthly' : 'premium_plus_yearly',
    requestKey: 'request-key-' + String(i).padStart(16, '0'),
    providerRequestId: 'provider-id-' + String(i).padStart(16, '0'),
  });

  it('allows exactly one account-wide claim out of 100 competing requests', async () => {
    const db = createFakeAtomicStore();
    const outcomes = await Promise.all(Array.from({ length: 100 }, (_, i) =>
      claimCheckoutIntent(db.adapter, input(i))));
    expect(outcomes.filter((x) => x.kind === 'created')).toHaveLength(1);
    expect(outcomes.filter((x) => x.kind === 'conflict')).toHaveLength(99);
    expect(db.outstanding.size).toBe(1);
    expect(db.calls.provider).toBe(0);
    const other = await claimCheckoutIntent(db.adapter, input(0, 'user-b'));
    expect(other.kind).toBe('created');
  });

  it('does not authorize another provider create on exact retry or unknown outcome', async () => {
    const db = createFakeAtomicStore();
    const request = input(1);
    const first = await claimCheckoutIntent(db.adapter, request);
    expect((await claimCheckoutIntent(db.adapter, request)).kind).toBe('existing');
    const started = await advanceCheckoutIntent(db.adapter, first.intent, 'provider_request_started');
    const unknown = await advanceCheckoutIntent(db.adapter, started, 'provider_outcome_unknown');
    expect((await claimCheckoutIntent(db.adapter, request)).kind).toBe('existing');
    expect((await claimCheckoutIntent(db.adapter, input(3))).kind).toBe('conflict');
    await expect(advanceCheckoutIntent(db.adapter, unknown, 'local_recorded')).rejects.toThrow();
    expect(db.calls.provider).toBe(0);
  });

  it('rejects stale fencing updates and releases only on explicitly terminal state', async () => {
    const db = createFakeAtomicStore();
    const first = await claimCheckoutIntent(db.adapter, input(0));
    const started = await advanceCheckoutIntent(db.adapter, first.intent, 'provider_request_started');
    await expect(advanceCheckoutIntent(db.adapter, first.intent, 'provider_request_started')).rejects.toThrow();
    expect(db.outstanding.size).toBe(1);
    const created = await recordVerifiedProviderCreation(db.adapter, started);
    const recorded = await advanceCheckoutIntent(db.adapter, created, 'local_record_failed');
    const terminal = await advanceCheckoutIntent(db.adapter, recorded, 'verified_terminal');
    expect(terminal.state).toBe('verified_terminal');
    expect(db.outstanding.size).toBe(0);
    expect((await claimCheckoutIntent(db.adapter, input(2))).kind).toBe('created');
  });

  it('rejects mismatched existing reservations and redacts conflict details', async () => {
    const request = input(1);
    const proof = {
      intentId: 'existing-reservation', accountId: request.accountId,
      provider: request.provider, sku: request.sku,
      requestKey: request.requestKey, providerRequestId: request.providerRequestId,
      state: 'provider_outcome_unknown', version: 2,
    };
    const mock = (kind, intent) => ({ claimAtomic: async () => ({ kind, intent }) });
    expect((await claimCheckoutIntent(mock('existing', proof), request)).kind).toBe('existing');
    for (const broken of [
      { ...proof, accountId: 'another-account' },
      { ...proof, provider: 'wix' },
      { ...proof, sku: 'premium_plus_monthly' },
      { ...proof, requestKey: 'other-request-key-1234' },
      { ...proof, providerRequestId: 'other-provider-id-1234' },
      { ...proof, intentId: '' },
      { ...proof, state: 'verified_terminal' },
      { ...proof, state: 'unknown' },
      { ...proof, version: Number.MAX_SAFE_INTEGER + 1 },
    ]) {
      await expect(claimCheckoutIntent(mock('existing', broken), request))
        .rejects.toThrow('Reservation proof invalid');
    }
    const conflict = await claimCheckoutIntent(mock('conflict', {
      ...proof, accountId: 'another-account', providerRequestId: 'do-not-leak',
    }), request);
    expect(conflict).toEqual({ kind: 'conflict', intent: null });
  });

  it('never releases an outstanding reservation without provider-verified terminal evidence', async () => {
    const db = createFakeAtomicStore();
    const claimed = await claimCheckoutIntent(db.adapter, input(1));
    const started = await advanceCheckoutIntent(db.adapter, claimed.intent, 'provider_request_started');
    const created = await recordVerifiedProviderCreation(db.adapter, started);
    const recorded = await advanceCheckoutIntent(db.adapter, created, 'local_record_failed');
    const before = db.calls.cas;
    await expect(advanceCheckoutIntent({
      ...db.adapter,
      verifyTerminalOutcome: undefined,
    }, recorded, 'verified_terminal')).rejects.toThrow('Verified provider terminal outcome required');
    await expect(advanceCheckoutIntent({
      ...db.adapter,
      verifyTerminalOutcome: async () => ({ verified: true, terminal: true,
        intentId: recorded.intentId, accountId: 'wrong-account',
        provider: recorded.provider, providerRequestId: recorded.providerRequestId }),
    }, recorded, 'verified_terminal')).rejects.toThrow();
    await expect(advanceCheckoutIntent({
      ...db.adapter,
      verifyTerminalOutcome: async () => null,
    }, recorded, 'verified_terminal')).rejects.toThrow();
    expect(db.calls.cas).toBe(before);
    expect(db.outstanding.has(recorded.accountId)).toBe(true);
    const final = await advanceCheckoutIntent(db.adapter, recorded, 'verified_terminal');
    expect(final.state).toBe('verified_terminal');
    expect(db.outstanding.has(recorded.accountId)).toBe(false);
  });

  it('never declares a local subscription record without verified durable receipt', async () => {
    const db = createFakeAtomicStore();
    const first = await claimCheckoutIntent(db.adapter, input(1));
    const started = await advanceCheckoutIntent(db.adapter, first.intent, 'provider_request_started');
    const created = await recordVerifiedProviderCreation(db.adapter, started);
    const casBefore = db.calls.cas;
    await expect(advanceCheckoutIntent(db.adapter, created, 'local_recorded'))
      .rejects.toThrow('Transition requires verified reconciliation');
    const failed = await advanceCheckoutIntent(db.adapter, created, 'local_record_failed');
    await expect(advanceCheckoutIntent(db.adapter, failed, 'local_recorded'))
      .rejects.toThrow('Transition requires verified reconciliation');
    expect(db.calls.cas).toBe(casBefore + 1);
  });

  it('blocks generic provider-created transition without storing provider ID', async () => {
    const db = createFakeAtomicStore();
    const first = await claimCheckoutIntent(db.adapter, input(1));
    const started = await advanceCheckoutIntent(db.adapter, first.intent, 'provider_request_started');
    const calls = db.calls.cas;
    await expect(advanceCheckoutIntent(db.adapter, started, 'provider_created')).rejects.toThrow();
    expect(db.calls.cas).toBe(calls);
    expect(db.outstanding.get(started.accountId).state).toBe('provider_request_started');
    await expect(recordVerifiedProviderCreation({
      ...db.adapter, verifyCreatedSubscription: undefined,
    }, started)).rejects.toThrow('Trusted provider creation verification unavailable');
    await expect(recordVerifiedProviderCreation({
      ...db.adapter, verifyCreatedSubscription: async () => ({
        verified: true, intentId: started.intentId, accountId: 'wrong-account',
        provider: started.provider, providerRequestId: started.providerRequestId,
        providerId: 'I-MOCKSUBSCRIPTION1234',
      }),
    }, started)).rejects.toThrow('Provider creation identity unverified');
    expect(db.outstanding.get(started.accountId).state).toBe('provider_request_started');
    const created = await recordVerifiedProviderCreation(db.adapter, started);
    expect(created.providerId).toBe('I-MOCKSUBSCRIPTION1234');
    expect(created.state).toBe('provider_created');
    await expect(recordVerifiedProviderCreation(db.adapter, started)).rejects.toThrow();
  });

  it('fails closed if database adapter is absent or violates its contract', async () => {
    await expect(claimCheckoutIntent(null, input(0))).rejects.toThrow();
    await expect(claimCheckoutIntent({ claimAtomic: async () => ({ kind: 'conflict' }) }, {
      ...input(0), providerRequestId: undefined,
    })).rejects.toThrow('Stable provider request identity required');
    await expect(claimCheckoutIntent({ claimAtomic: async () => ({ kind: 'created' }) }, input(0))).rejects.toThrow();
    await expect(claimCheckoutIntent({ claimAtomic: async () => ({ kind: 'unlocked' }) }, input(0))).rejects.toThrow();
  });
});
