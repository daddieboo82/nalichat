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
  provider_request_started: new Set(['provider_outcome_unknown']),
  // An ambiguous provider create cannot be treated as terminal until the
  // original provider agreement has been independently located and stored.
  // Releasing an unidentified agreement risks duplicate paid subscriptions.
  provider_outcome_unknown: new Set(),
  // local_recorded is deliberately unavailable until a separate, trusted
  // persisted-subscription receipt is implemented and checked.
  provider_created: new Set(['local_record_failed', 'verified_terminal']),
  local_record_failed: new Set(['verified_terminal']),
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
  if (typeof input.providerRequestId !== 'string'
    || !/^[A-Za-z0-9._~-]{16,128}$/.test(input.providerRequestId)) {
    throw new Error('Stable provider request identity required');
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
  if (outcome.kind === 'created' || outcome.kind === 'existing') {
    const intent = outcome.intent;
    if (!intent || typeof intent.intentId !== 'string' || !intent.intentId
      || intent.accountId !== input.accountId
      || intent.providerRequestId !== input.providerRequestId
      || intent.provider !== input.provider || intent.sku !== input.sku
      || intent.requestKey !== input.requestKey
      || !Number.isSafeInteger(intent.version) || intent.version < 1
    || intent.version >= Number.MAX_SAFE_INTEGER
      || (outcome.kind === 'created' && (intent.state !== 'reserved' || intent.providerId !== null || intent.version !== 1))
      || (outcome.kind === 'existing' && (!CHECKOUT_STATES.includes(intent.state)
        || (intent.providerId !== null && (typeof intent.providerId !== 'string'
          || !/^[A-Za-z0-9-]{8,128}$/.test(intent.providerId)))
        || (intent.state === 'reserved' && (intent.version !== 1 || intent.providerId !== null))
        || (['provider_request_started', 'provider_outcome_unknown'].includes(intent.state)
          && intent.providerId !== null)
        || (['provider_created', 'local_record_failed', 'local_recorded'].includes(intent.state)
          && intent.providerId === null)))
      || intent.state === 'verified_terminal') {
      throw new Error('Reservation proof invalid');
    }
  }
  // A distinct outstanding checkout is an opaque conflict. Never return its
  // reservation identifier or payment-provider details to this caller.
  return Object.freeze({
    kind: outcome.kind,
    intent: outcome.kind === 'conflict' ? null : outcome.intent,
  });
}
/**
 * Provider creation is a special transition: atomically store the verified
 * subscription identity along with the state change. A plain CAS must never
 * move a checkout into provider_created with a missing provider ID.
 *
 * `verifyCreatedSubscription` must be implemented by a trusted backend that
 * independently reads/authenticates the provider response; never pass user
 * supplied verification callbacks into this function.
 */
export async function recordVerifiedProviderCreation(adapter, intent) {
  if (!intent || !['provider_request_started', 'provider_outcome_unknown'].includes(intent.state)
    || !Number.isSafeInteger(intent.version) || intent.version < 1
    || intent.version >= Number.MAX_SAFE_INTEGER
    || typeof intent.intentId !== 'string' || !intent.intentId
    || typeof intent.accountId !== 'string' || !intent.accountId
    || !['paypal', 'wix'].includes(intent.provider)
    || typeof intent.providerRequestId !== 'string' || !intent.providerRequestId
    || intent.providerId !== null) {
    throw new Error('Checkout provider creation state invalid');
  }
  if (typeof adapter?.verifyCreatedSubscription !== 'function'
    || typeof adapter?.recordProviderSubscription !== 'function') {
    throw new Error('Trusted provider creation verification unavailable');
  }
  const evidence = await adapter.verifyCreatedSubscription(intent);
  if (!evidence || evidence.verified !== true
    || evidence.intentId !== intent.intentId
    || evidence.accountId !== intent.accountId
    || evidence.provider !== intent.provider
    || evidence.sku !== intent.sku
    || evidence.requestKey !== intent.requestKey
    || evidence.providerRequestId !== intent.providerRequestId
    || typeof evidence.providerId !== 'string'
    || !/^[A-Za-z0-9-]{8,128}$/.test(evidence.providerId)) {
    throw new Error('Provider creation identity unverified');
  }
  const updated = await adapter.recordProviderSubscription({
    intentId: intent.intentId,
    accountId: intent.accountId,
    provider: intent.provider,
    sku: intent.sku,
    requestKey: intent.requestKey,
    providerRequestId: intent.providerRequestId,
    expectedState: intent.state,
    expectedVersion: intent.version,
    providerId: evidence.providerId,
  });
  if (!updated || updated.intentId !== intent.intentId
    || updated.accountId !== intent.accountId
    || updated.provider !== intent.provider
    || updated.sku !== intent.sku || updated.requestKey !== intent.requestKey
    || updated.providerRequestId !== intent.providerRequestId
    || updated.providerId !== evidence.providerId
    || updated.state !== 'provider_created' || updated.version !== intent.version + 1) {
    throw new Error('Verified provider creation was not durably recorded');
  }
  return Object.freeze(updated);
}

/**
 * Transition requires a compare-and-swap performed by the adapter. A lost
 * provider response must remain unresolved; no lease timeout unlock allowed.
 */
export async function advanceCheckoutIntent(adapter, intent, nextState) {
  if (!intent || !Number.isSafeInteger(intent.version) || intent.version < 1
    || intent.version >= Number.MAX_SAFE_INTEGER
    || !ALLOWED[intent.state]?.has(nextState)) {
    throw new Error('Transition requires verified reconciliation');
  }
  let updated;
  if (nextState === 'verified_terminal') {
    // Only a trusted backend adapter with an independently authenticated
    // provider reader may release an account. Never pass verification results
    // from client data or use generic CAS for this transition.
    if (typeof adapter?.releaseVerifiedTerminal !== 'function') {
      throw new Error('Verified terminal release store unavailable');
    }
    updated = await adapter.releaseVerifiedTerminal(intent);
  } else {
    if (typeof adapter?.compareAndSwap !== 'function') {
      throw new Error('Atomic update store unavailable');
    }
    updated = await adapter.compareAndSwap({
      intentId: intent.intentId,
      accountId: intent.accountId,
      expectedState: intent.state,
      expectedVersion: intent.version,
      nextState,
    });
  }
  if (!updated || updated.intentId !== intent.intentId || updated.accountId !== intent.accountId
    || updated.provider !== intent.provider || updated.sku !== intent.sku
    || updated.requestKey !== intent.requestKey
    || updated.providerRequestId !== intent.providerRequestId
    || updated.providerId !== intent.providerId
    || updated.state !== nextState || updated.version !== intent.version + 1) {
    throw new Error('Checkout fencing/version mismatch');
  }
  return Object.freeze(updated);
}

/**
 * DRAFT ONLY. This confirms a local Subscription entity already exists and
 * matches the provider agreement. The adapter owns the independent trusted
 * read and conditional DB update. No request-provided receipt is accepted.
 */
export async function confirmVerifiedLocalSubscription(adapter, intent) {
  if (!intent || !['provider_created', 'local_record_failed'].includes(intent.state)
    || !Number.isSafeInteger(intent.version) || intent.version < 1
    || intent.version >= Number.MAX_SAFE_INTEGER
    || typeof adapter?.confirmLocalSubscriptionRecorded !== 'function') {
    throw new Error('Verified local subscription persistence unavailable');
  }
  const updated = await adapter.confirmLocalSubscriptionRecorded(intent);
  if (!updated || updated.intentId !== intent.intentId
    || updated.accountId !== intent.accountId
    || updated.provider !== intent.provider || updated.sku !== intent.sku
    || updated.requestKey !== intent.requestKey
    || updated.providerRequestId !== intent.providerRequestId
    || updated.providerId !== intent.providerId
    || updated.state !== 'local_recorded'
    || updated.version !== intent.version + 1) {
    throw new Error('Verified local subscription persistence proof invalid');
  }
  return Object.freeze(updated);
}
