/**
 * Draft checkout coordinator contract — NOT a production lock or checkout route.
 * All mutation must go through a datastore adapter whose operations are
 * independently proven atomic. This module NEVER calls payment providers.
 */
export const CHECKOUT_STATES = Object.freeze([
  'reserved', 'provider_request_started', 'provider_outcome_unknown',
  'provider_created', 'local_record_failed', 'local_recorded',
  'verified_terminal',
]);
const ALLOWED = {
  reserved: new Set(['provider_request_started']),
  provider_request_started: new Set(['provider_outcome_unknown', 'provider_created']),
  provider_outcome_unknown: new Set(['provider_created', 'verified_terminal']),
  provider_created: new Set(['local_record_failed', 'local_recorded', 'verified_terminal']),
  local_record_failed: new Set(['local_recorded', 'verified_terminal']),
  local_recorded: new Set(['verified_terminal']),
  verified_terminal: new Set(),
};
export function validateCheckoutIntentInput(input) {
  if (!input || typeof input !== 'object') throw new Error('Invalid checkout input');
  if (typeof input.accountId !== 'string' || !input.accountId.trim()) throw new Error('Authenticated account required');
  if (!['paypal', 'wix'].includes(input.provider)) throw new Error('Invalid payment provider');
  if (typeof input.sku !== 'string' || !/^(premium|premium_plus)_(monthly|yearly)$/.test(input.sku)) {
    throw new Error('Invalid subscription SKU');
  }
  if (typeof input.requestKey !== 'string' || !/^[A-Za-z0-9._~-]{16,128}$/.test(input.requestKey)) {
    throw new Error('Invalid request key');
  }
}
/**
 * adapter.claimAtomic must atomically enforce at most one outstanding
 * account-wide intent (regardless of provider/SKU/key), persist it BEFORE any
 * provider call, and return {kind:'created'|'existing'|'conflict',intent?}.
 * A duplicate same-key claim NEVER authorizes provider creation by itself.
 */
export async function claimCheckoutIntent(adapter, input) {
  validateCheckoutIntentInput(input);
  if (typeof adapter?.claimAtomic !== 'function') throw new Error('Atomic reservation store unavailable');
  const outcome = await adapter.claimAtomic(input);
  if (!outcome || !['created', 'existing', 'conflict'].includes(outcome.kind)) {
    throw new Error('Reservation store response unverified');
  }
  if (outcome.kind === 'created') {
    if (outcome.intent?.accountId !== input.accountId || outcome.intent?.state !== 'reserved'
      || !Number.isSafeInteger(outcome.intent?.version) || outcome.intent.version < 1) {
      throw new Error('Reservation proof invalid');
    }
  }
  return Object.freeze({ kind: outcome.kind, intent: outcome.intent ?? null });
}
/**
 * Transition requires a compare-and-swap performed by the adapter. A lost
 * provider response must remain unresolved; no lease timeout unlock allowed.
 */
export async function advanceCheckoutIntent(adapter, intent, nextState) {
  if (!intent || !Number.isSafeInteger(intent.version) || intent.version < 1
    || !ALLOWED[intent.state]?.has(nextState)) {
    throw new Error('Transition requires verified reconciliation');
  }
  if (typeof adapter?.compareAndSwap !== 'function') throw new Error('Atomic update store unavailable');
  const updated = await adapter.compareAndSwap({
    intentId: intent.intentId,
    accountId: intent.accountId,
    expectedState: intent.state,
    expectedVersion: intent.version,
    nextState,
  });
  if (!updated || updated.intentId !== intent.intentId || updated.accountId !== intent.accountId
    || updated.state !== nextState || updated.version !== intent.version + 1) {
    throw new Error('Checkout fencing/version mismatch');
  }
  return Object.freeze(updated);
}
