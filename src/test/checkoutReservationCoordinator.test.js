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
        state: 'reserved', version: 1, providerId: null,
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
    async releaseVerifiedTerminal(intent) {
      const evidence = await this.verifyTerminalOutcome(intent);
      if (!evidence || evidence.verified !== true || evidence.terminal !== true
        || evidence.intentId !== intent.intentId
        || evidence.accountId !== intent.accountId
        || evidence.provider !== intent.provider
        || evidence.providerRequestId !== intent.providerRequestId
        || !intent.providerId) {
        throw new Error('Verified provider terminal outcome required');
      }
      const current = all.get(intent.intentId);
      if (!current || current.state !== intent.state
        || current.version !== intent.version
        || current.providerId !== intent.providerId) return null;
      const released = { ...current, state: 'verified_terminal', version: current.version + 1 };
      all.set(intent.intentId, released);
      outstanding.delete(intent.accountId);
      return { ...released };
    },
    async verifyCreatedSubscription(intent) {
      return {
        verified: true, intentId: intent.intentId, accountId: intent.accountId,
        provider: intent.provider, sku: intent.sku, requestKey: intent.requestKey,
        providerRequestId: intent.providerRequestId,
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
      state: 'provider_outcome_unknown', version: 2, providerId: null,
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
      { ...proof, providerId: undefined },
      { ...proof, providerId: 'not/valid/id' },
      { ...proof, state: 'reserved', version: 2 },
      { ...proof, state: 'reserved', version: 1, providerId: 'I-BOUNDAGREEMENT1234' },
      { ...proof, state: 'provider_created', providerId: null },
      { ...proof, state: 'local_record_failed', providerId: null },
      { ...proof, state: 'local_recorded', providerId: null },
    ]) {
      await expect(claimCheckoutIntent(mock('existing', broken), request))
        .rejects.toThrow('Reservation proof invalid');
    }
    // A new claim cannot arrive with an already-bound provider agreement.
    // A forged or inconsistent store response must never authorize creation.
    await expect(claimCheckoutIntent(mock('created', {
      ...proof, state: 'reserved', version: 1,
      providerId: 'I-ALREADYBOUND123456',
    }), request)).rejects.toThrow('Reservation proof invalid');
    await expect(claimCheckoutIntent(mock('created', {
      ...proof, state: 'reserved', version: 1, providerId: undefined,
    }), request)).rejects.toThrow('Reservation proof invalid');
    await expect(claimCheckoutIntent(mock('created', {
      ...proof, state: 'reserved', version: 2, providerId: null,
    }), request)).rejects.toThrow('Reservation proof invalid');
    const conflict = await claimCheckoutIntent(mock('conflict', {
      ...proof, accountId: 'another-account', providerRequestId: 'do-not-leak',
    }), request);
    expect(conflict).toEqual({ kind: 'conflict', intent: null });
  });

  it('never releases an unknown provider create without identifying its agreement', async () => {
    const db = createFakeAtomicStore();
    const claim = await claimCheckoutIntent(db.adapter, input(1));
    const started = await advanceCheckoutIntent(db.adapter, claim.intent, 'provider_request_started');
    const unknown = await advanceCheckoutIntent(db.adapter, started, 'provider_outcome_unknown');
    const before = db.calls.cas;
    await expect(advanceCheckoutIntent({
      ...db.adapter,
      releaseVerifiedTerminal: async () => { throw new Error('Must not attempt release'); },
    }, unknown, 'verified_terminal')).rejects.toThrow('Transition requires verified reconciliation');
    expect(db.calls.cas).toBe(before);
    expect(db.outstanding.get(unknown.accountId).state).toBe('provider_outcome_unknown');
  });

  it('never releases an outstanding reservation without provider-verified terminal evidence', async () => {
    const db = createFakeAtomicStore();
    const claimed = await claimCheckoutIntent(db.adapter, input(1));
    const started = await advanceCheckoutIntent(db.adapter, claimed.intent, 'provider_request_started');
    const created = await recordVerifiedProviderCreation(db.adapter, started);
    const recorded = await advanceCheckoutIntent(db.adapter, created, 'local_record_failed');
    const before = db.calls.cas;
    await expect(advanceCheckoutIntent({
      ...db.adapter, releaseVerifiedTerminal: undefined,
    }, recorded, 'verified_terminal')).rejects.toThrow('Verified terminal release store unavailable');
    await expect(advanceCheckoutIntent({
      ...db.adapter,
      releaseVerifiedTerminal: async () => { throw new Error('Provider status unknown'); },
    }, recorded, 'verified_terminal')).rejects.toThrow('Provider status unknown');
    await expect(advanceCheckoutIntent({
      ...db.adapter,
      releaseVerifiedTerminal: async () => ({
        ...recorded, accountId: 'wrong-account',
        state: 'verified_terminal', version: recorded.version + 1,
      }),
    }, recorded, 'verified_terminal')).rejects.toThrow('Checkout fencing/version mismatch');
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

  it('rejects CAS results that change immutable checkout identities', async () => {
    const db = createFakeAtomicStore();
    const first = await claimCheckoutIntent(db.adapter, input(1));
    const mismatches = [
      { provider: 'wix' },
      { sku: 'premium_plus_yearly' },
      { requestKey: 'different-client-key-12345678' },
      { providerRequestId: 'different-provider-key-12345678' },
      { providerId: 'I-SUBSCRIPTION-MISMATCH' },
    ];
    for (const mismatch of mismatches) {
      const forged = {
        ...db.adapter,
        compareAndSwap: async ({ nextState, expectedVersion }) => ({
          ...first.intent, ...mismatch, state: nextState, version: expectedVersion + 1,
        }),
      };
      await expect(advanceCheckoutIntent(forged, first.intent, 'provider_request_started'))
        .rejects.toThrow('Checkout fencing/version mismatch');
    }
    expect(db.outstanding.get(first.intent.accountId).state).toBe('reserved');
    expect(db.calls.cas).toBe(0);
  });

  it('rejects provider creation evidence with incorrect plan or client key before writing', async () => {
    const db = createFakeAtomicStore();
    const claimed = await claimCheckoutIntent(db.adapter, input(1));
    const started = await advanceCheckoutIntent(db.adapter, claimed.intent, 'provider_request_started');
    for (const mismatch of [
      { sku: 'premium_plus_yearly' },
      { requestKey: 'different-client-request-123456' },
      { sku: undefined },
      { requestKey: undefined },
    ]) {
      let writes = 0;
      const forged = {
        ...db.adapter,
        verifyCreatedSubscription: async (intent) => ({
          verified: true, intentId: intent.intentId, accountId: intent.accountId,
          provider: intent.provider, sku: intent.sku, requestKey: intent.requestKey,
          providerRequestId: intent.providerRequestId,
          providerId: 'I-MOCKSUBSCRIPTION1234', ...mismatch,
        }),
        recordProviderSubscription: async () => { writes++; throw new Error('unexpected write'); },
      };
      await expect(recordVerifiedProviderCreation(forged, started))
        .rejects.toThrow('Provider creation identity unverified');
      expect(writes).toBe(0);
    }
    expect(db.outstanding.get(started.accountId).state).toBe('provider_request_started');
  });

  it('rejects provider creation write proofs with mismatched plan or client key', async () => {
    const db = createFakeAtomicStore();
    const first = await claimCheckoutIntent(db.adapter, input(1));
    const started = await advanceCheckoutIntent(db.adapter, first.intent, 'provider_request_started');
    for (const difference of [
      { sku: 'premium_plus_yearly' },
      { requestKey: 'another-client-key-123456789' },
    ]) {
      const forged = {
        ...db.adapter,
        recordProviderSubscription: async () => ({
          ...started, ...difference,
          state: 'provider_created',
          version: started.version + 1,
          providerId: 'I-MOCKSUBSCRIPTION1234',
        }),
      };
      await expect(recordVerifiedProviderCreation(forged, started))
        .rejects.toThrow('Verified provider creation was not durably recorded');
    }
    expect(db.outstanding.get(started.accountId).state).toBe('provider_request_started');
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
