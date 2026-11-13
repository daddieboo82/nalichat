// Shared PayPal webhook ledger logic — mirrors the Stripe webhook ledger pattern
// to provide idempotent event processing and stale-event protection.

export function paypalWebhookLedgerAction(
  state: unknown,
  updatedAt: unknown,
  nowMs = Date.now(),
): 'duplicate' | 'busy' | 'retry' | 'start' {
  if (state === 'processed' || state === 'ignored') {
    return 'duplicate';
  }
  if (state !== 'processing') {
    return state === undefined || state === null ? 'start' : 'retry';
  }
  const updatedAtMs = typeof updatedAt === 'string' ? Date.parse(updatedAt) : Number.NaN;
  return Number.isFinite(updatedAtMs) && nowMs - updatedAtMs >= 10 * 60 * 1000
    ? 'retry'
    : 'busy';
}

// Stale-event protection: skip events older than the last one applied to the
// subscription record. PayPal's create_time is an ISO 8601 string.
export function shouldApplyPayPalEvent(
  lastEventId: unknown,
  lastEventTime: unknown,
  incomingEventId: string,
  incomingEventTime: string,
  nowMs = Date.now(),
): boolean {
  if (lastEventId === incomingEventId) return false;
  // An invalid incoming event time cannot be ordered against previous
  // lifecycle events. Never substitute receipt time and apply it as newest.
  const incomingMs = typeof incomingEventTime === 'string'
    ? Date.parse(incomingEventTime)
    : Number.NaN;
  // A far-future timestamp can permanently outrank legitimate subsequent
  // events. Allow modest provider/merchant clock skew, but never apply an
  // event more than five minutes ahead of the server's clock.
  if (!Number.isFinite(incomingMs) || incomingMs > nowMs + 5 * 60_000) return false;
  // A legacy record may have an event ID but no usable time. That does
  // not establish whether the incoming event precedes an already-applied
  // lifecycle change. Require reconciliation rather than guessing.
  if (typeof lastEventTime !== 'string' || lastEventTime.length === 0) {
    return typeof lastEventId !== 'string' || lastEventId.length === 0;
  }
  const lastMs = Date.parse(lastEventTime);
  if (!Number.isFinite(lastMs)) return false;
  // Distinct lifecycle events at the exact same provider timestamp cannot be
  // reliably ordered. Do not let delivery order decide subscription access.
  // A later provider reconciliation can resolve the actual current state.
  return incomingMs > lastMs;
}