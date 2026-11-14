/**
 * Pure billing checkout intent policy for a future transaction-backed worker.
 * This module neither acquires a lock nor calls payment providers. Every
 * caller MUST first atomically reserve the account in a durable store.
 */
export type CheckoutIntentState =
  | 'reserved'
  | 'provider_request_started'
  | 'provider_outcome_unknown'
  | 'provider_created'
  | 'local_record_failed'
  | 'local_recorded'
  | 'verified_terminal';

export type CheckoutIntentEvent =
  | 'provider_request_started'
  | 'provider_response_lost'
  | 'provider_creation_confirmed'
  | 'local_write_failed'
  | 'local_write_succeeded'
  | 'provider_terminal_confirmed';

const ALLOWED: Readonly<Record<CheckoutIntentState, readonly CheckoutIntentEvent[]>> = {
  reserved: ['provider_request_started'],
  provider_request_started: ['provider_response_lost', 'provider_creation_confirmed'],
  provider_outcome_unknown: ['provider_creation_confirmed', 'provider_terminal_confirmed'],
  provider_created: ['local_write_failed', 'local_write_succeeded', 'provider_terminal_confirmed'],
  local_record_failed: ['local_write_succeeded', 'provider_terminal_confirmed'],
  local_recorded: ['provider_terminal_confirmed'],
  verified_terminal: [],
};

export function isOutstandingCheckoutIntent(state: CheckoutIntentState): boolean {
  return state !== 'verified_terminal';
}

export function nextCheckoutIntentState(
  state: CheckoutIntentState,
  event: CheckoutIntentEvent,
): CheckoutIntentState {
  if (!ALLOWED[state]?.includes(event)) {
    throw new Error('Checkout intent transition requires provider reconciliation');
  }
  switch (event) {
    case 'provider_request_started':
      return 'provider_request_started';
    case 'provider_response_lost':
      return 'provider_outcome_unknown';
    case 'provider_creation_confirmed':
      return 'provider_created';
    case 'local_write_failed':
      return 'local_record_failed';
    case 'local_write_succeeded':
      return 'local_recorded';
    case 'provider_terminal_confirmed':
      return 'verified_terminal';
  }
}

/**
 * A request can be retried ONLY in the pre-provider 'reserved' state and
 * ONLY for the same intent and provider request identity. The worker must
 * durably advance to provider_request_started *before* contacting PayPal;
 * on restart, that state requires remote reconciliation rather than another
 * provider create call. This helper alone is NOT authorization to send any
 * provider request: the worker also needs an atomic ownership/fencing claim.
 * Distinct keys must never bypass an unresolved account-level reservation.
 */
export function canRetryOutstandingIntent(
  state: CheckoutIntentState,
  existingIntentId: string,
  requestedIntentId: string,
  originalProviderRequestId: string,
  requestedProviderRequestId: string,
): boolean {
  return state === 'reserved'
    && existingIntentId.length > 0
    && originalProviderRequestId.length > 0
    && existingIntentId === requestedIntentId
    && originalProviderRequestId === requestedProviderRequestId;
}
