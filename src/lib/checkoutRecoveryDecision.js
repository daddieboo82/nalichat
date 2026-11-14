/**
 * Draft-only crash-recovery policy for recurring checkout.
 * No provider calls, no provider creation, no state mutation.
 *
 * PayPal's current subscription create request custom_id is accountId:sku,
 * not a unique provider request key. Therefore an unknown create response
 * cannot be safely recovered by simply issuing another create or looking
 * up a subscription by client idempotency key. Keep the account reserved
 * until a trusted, independently authenticated reconciliation can identify
 * the provider agreement or prove there is none.
 */
export function decideCheckoutRecovery(intent) {
  if (!intent || !['paypal', 'wix'].includes(intent.provider)
    || typeof intent.intentId !== 'string' || !intent.intentId
    || typeof intent.accountId !== 'string' || !intent.accountId
    || typeof intent.providerRequestId !== 'string' || !intent.providerRequestId
    || typeof intent.state !== 'string') {
    throw new Error('Checkout recovery context invalid');
  }
  const hasProviderId = typeof intent.providerId === 'string'
    && /^[A-Za-z0-9-]{8,128}$/.test(intent.providerId);
  if (intent.state === 'verified_terminal') {
    return Object.freeze({ action: 'no_checkout_create', reason: 'already_verified_terminal' });
  }
  if (intent.state === 'reserved') {
    // A reserved intent is not proof that a provider request did not begin:
    // the exact prior state must be atomically advanced before any create.
    return Object.freeze({ action: 'no_checkout_create', reason: 'needs_atomic_start' });
  }
  if (intent.state === 'provider_request_started'
    || intent.state === 'provider_outcome_unknown') {
    return Object.freeze({
      action: 'no_checkout_create',
      reason: hasProviderId ? 'verify_existing_provider_agreement' : 'manual_provider_reconciliation_required',
    });
  }
  if (['provider_created', 'local_record_failed', 'local_recorded'].includes(intent.state)) {
    if (!hasProviderId) {
      throw new Error('Provider agreement identity missing from persisted checkout');
    }
    return Object.freeze({ action: 'no_checkout_create', reason: 'verify_existing_provider_agreement' });
  }
  throw new Error('Unknown checkout state; fail closed');
}
