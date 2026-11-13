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
): boolean {
  if (lastEventId === incomingEventId) return false;
  // An invalid incoming event time cannot be ordered against previous
  // lifecycle events. Never substitute receipt time and apply it as newest.
  const incomingMs = typeof incomingEventTime === 'string'
    ? Date.parse(incomingEventTime)
    : Number.NaN;
  if (!Number.isFinite(incomingMs)) return false;
  if (typeof lastEventTime !== 'string' || lastEventTime.length === 0) {
    return true;
  }
  const lastMs = Date.parse(lastEventTime);
  // A malformed legacy stored time cannot establish ordering. The caller
  // must still verify subscription state for activation-capable events.
  if (!Number.isFinite(lastMs)) return true;
  return incomingMs >= lastMs;
}