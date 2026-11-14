import { describe, expect, it } from 'vitest';
import { decideCheckoutRecovery } from '@/lib/checkoutRecoveryDecision';

const base = {
  intentId: 'intent-123', accountId: 'account-123', provider: 'paypal',
  sku: 'premium_monthly', requestKey: 'client-request-key-123',
  providerRequestId: 'original-request-123', providerId: null, version: 1,
};

describe('draft checkout crash recovery policy (no payment API calls)', () => {
  it.each(['paypal', 'wix'])('never creates another %s subscription for ambiguous create responses', (provider) => {
    for (const state of ['provider_request_started', 'provider_outcome_unknown']) {
      const decision = decideCheckoutRecovery({ ...base, provider, state });
      expect(decision).toEqual({
        action: 'no_checkout_create', reason: 'manual_provider_reconciliation_required',
      });
    }
  });

  it('requires verification of a known provider agreement instead of re-creation', () => {
    for (const state of ['provider_created', 'local_record_failed', 'local_recorded']) {
      expect(decideCheckoutRecovery({
        ...base, state, providerId: 'I-KNOWN12345678',
      })).toEqual({
        action: 'no_checkout_create', reason: 'verify_existing_provider_agreement',
      });
    }
  });

  it('rejects premature agreement IDs and missing terminal identities', () => {
    for (const state of ['reserved', 'provider_request_started', 'provider_outcome_unknown']) {
      for (const providerId of ['I-KNOWN12345678', undefined]) {
        expect(() => decideCheckoutRecovery({ ...base, state, providerId }))
          .toThrow('Checkout recovery provider identity inconsistent with state');
      }
    }
    expect(() => decideCheckoutRecovery({ ...base, state: 'verified_terminal' }))
      .toThrow('Checkout recovery provider identity inconsistent with state');
    expect(decideCheckoutRecovery({
      ...base, state: 'verified_terminal', providerId: 'I-KNOWN12345678',
    }).action).toBe('no_checkout_create');
  });

  it('refuses an unrecorded agreement identifier after creation', () => {
    for (const state of ['provider_created', 'local_record_failed', 'local_recorded']) {
      expect(() => decideCheckoutRecovery({ ...base, state })).toThrow();
    }
  });

  it('cannot retry creation even from reserved or terminal state', () => {
    expect(decideCheckoutRecovery({ ...base, state: 'reserved' }).action)
      .toBe('no_checkout_create');
    expect(decideCheckoutRecovery({
      ...base, state: 'verified_terminal', providerId: 'I-KNOWN12345678',
    }).action).toBe('no_checkout_create');
  });

  it('rejects malformed plan, request identity and fencing token before recovery', () => {
    const valid = { ...base, state: 'provider_outcome_unknown' };
    for (const changes of [
      { sku: 'unknown_plan' },
      { sku: undefined },
      { requestKey: '' },
      { requestKey: 'bad key with spaces' },
      { providerRequestId: '../invalid-provider-request' },
      { version: 0 },
      { version: Number.MAX_SAFE_INTEGER },
      { version: Number.MAX_SAFE_INTEGER + 1 },
      { version: undefined },
    ]) {
      expect(() => decideCheckoutRecovery({ ...valid, ...changes }))
        .toThrow('Checkout recovery context invalid');
    }
    expect(decideCheckoutRecovery(valid)).toEqual({
      action: 'no_checkout_create', reason: 'manual_provider_reconciliation_required',
    });
  });

  it('fails closed for unknown state or missing identity', () => {
    expect(() => decideCheckoutRecovery({ ...base, state: 'unknown' })).toThrow();
    expect(() => decideCheckoutRecovery({ ...base, state: 'reserved', providerRequestId: '' })).toThrow();
  });
});
