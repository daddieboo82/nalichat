import { describe, expect, it } from 'vitest';
import {
  canRetryOutstandingIntent,
  isOutstandingCheckoutIntent,
  nextCheckoutIntentState,
} from '../../base44/shared/billingCheckoutIntent.ts';

describe('future atomic checkout-intent worker policy (not a lock)', () => {
  it('keeps every unresolved state exclusively reserved', () => {
    for (const state of [
      'reserved', 'provider_outcome_unknown', 'provider_created',
      'local_record_failed', 'local_recorded',
    ]) {
      expect(isOutstandingCheckoutIntent(state)).toBe(true);
    }
    expect(isOutstandingCheckoutIntent('verified_terminal')).toBe(false);
  });

  it('requires reconciliation after a lost provider response', () => {
    expect(nextCheckoutIntentState('reserved', 'provider_response_lost')).toBe('provider_outcome_unknown');
    expect(() => nextCheckoutIntentState('provider_outcome_unknown', 'local_write_succeeded')).toThrow();
    expect(nextCheckoutIntentState('provider_outcome_unknown', 'provider_creation_confirmed')).toBe('provider_created');
  });

  it('keeps a failed local write reserved until recovery', () => {
    expect(nextCheckoutIntentState('reserved', 'provider_creation_confirmed')).toBe('provider_created');
    expect(nextCheckoutIntentState('provider_created', 'local_write_failed')).toBe('local_record_failed');
    expect(nextCheckoutIntentState('local_record_failed', 'local_write_succeeded')).toBe('local_recorded');
  });

  it('releases only after an independently verified terminal event', () => {
    expect(nextCheckoutIntentState('local_recorded', 'provider_terminal_confirmed')).toBe('verified_terminal');
    expect(() => nextCheckoutIntentState('verified_terminal', 'provider_creation_confirmed')).toThrow();
    expect(() => nextCheckoutIntentState('reserved', 'provider_terminal_confirmed')).toThrow();
    expect(() => nextCheckoutIntentState('reserved', 'local_write_succeeded')).toThrow();
  });

  it('does not allow a distinct intent or PayPal request ID to masquerade as a retry', () => {
    expect(canRetryOutstandingIntent('provider_outcome_unknown', 'intent-1', 'intent-1', 'paypal-key-1', 'paypal-key-1')).toBe(true);
    expect(canRetryOutstandingIntent('provider_outcome_unknown', 'intent-1', 'intent-2', 'paypal-key-1', 'paypal-key-1')).toBe(false);
    expect(canRetryOutstandingIntent('provider_outcome_unknown', 'intent-1', 'intent-1', 'paypal-key-1', 'paypal-key-2')).toBe(false);
    expect(canRetryOutstandingIntent('verified_terminal', 'intent-1', 'intent-1', 'paypal-key-1', 'paypal-key-1')).toBe(false);
    expect(canRetryOutstandingIntent('reserved', '', '', 'paypal-key-1', 'paypal-key-1')).toBe(false);
  });

  it('never unlocks based on age, lease expiration, or duplicate worker delivery', () => {
    expect(isOutstandingCheckoutIntent('provider_outcome_unknown')).toBe(true);
    expect(() => nextCheckoutIntentState('local_record_failed', 'provider_response_lost')).toThrow();
    expect(() => nextCheckoutIntentState('local_recorded', 'provider_creation_confirmed')).toThrow();
  });
});
