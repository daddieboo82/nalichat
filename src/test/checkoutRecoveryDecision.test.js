import { describe, expect, it } from 'vitest';
import { decideCheckoutRecovery } from '@/lib/checkoutRecoveryDecision';

const base = {
  intentId: 'intent-123', accountId: 'account-123', provider: 'paypal',
  providerRequestId: 'original-request-123', providerId: null,
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
    for (const state of [
      'provider_request_started', 'provider_outcome_unknown', 'provider_created',
      'local_record_failed', 'local_recorded',
    ]) {
      expect(decideCheckoutRecovery({
        ...base, state, providerId: 'I-KNOWN12345678',
      })).toEqual({
        action: 'no_checkout_create', reason: 'verify_existing_provider_agreement',
      });
    }
  });

  it('refuses an unrecorded agreement identifier after creation', () => {
    for (const state of ['provider_created', 'local_record_failed', 'local_recorded']) {
      expect(() => decideCheckoutRecovery({ ...base, state })).toThrow();
    }
  });

  it('cannot retry creation even from reserved or terminal state', () => {
    expect(decideCheckoutRecovery({ ...base, state: 'reserved' }).action)
      .toBe('no_checkout_create');
    expect(decideCheckoutRecovery({ ...base, state: 'verified_terminal' }).action)
      .toBe('no_checkout_create');
  });

  it('fails closed for unknown state or missing identity', () => {
    expect(() => decideCheckoutRecovery({ ...base, state: 'unknown' })).toThrow();
    expect(() => decideCheckoutRecovery({ ...base, state: 'reserved', providerRequestId: '' })).toThrow();
  });
});
