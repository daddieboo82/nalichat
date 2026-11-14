import { describe, expect, it } from 'vitest';
import { advanceCheckoutIntent, claimCheckoutIntent } from '@/lib/checkoutReservationCoordinator';

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
        state: 'reserved', version: 1,
      };
      outstanding.set(input.accountId, intent);
      all.set(intent.intentId, intent);
      return { kind: 'created', intent: { ...intent } };
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
    const created = await advanceCheckoutIntent(db.adapter, started, 'provider_created');
    const recorded = await advanceCheckoutIntent(db.adapter, created, 'local_recorded');
    const terminal = await advanceCheckoutIntent(db.adapter, recorded, 'verified_terminal');
    expect(terminal.state).toBe('verified_terminal');
    expect(db.outstanding.size).toBe(0);
    expect((await claimCheckoutIntent(db.adapter, input(2))).kind).toBe('created');
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
