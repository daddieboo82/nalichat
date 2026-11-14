/**
 * DRAFT SERVER-ONLY read/verification contract for NaliChat Subscription.
 * NOT connected to Base44 production or to a checkout HTTP endpoint.
 *
 * Only a trusted backend may provide fetchSubscriptions(filters, order, limit).
 * Do not inject a client-controlled reader or accept HTTP-supplied receipts.
 * The backend must use authenticated service-role reads; no read-before-create
 * behavior here provides locking or uniqueness for a subscription writer.
 *
 * Existing legacy PayPal/Wix records do not consistently carry all three
 * identity bindings below. They deliberately fail closed until an approved
 * idempotent writer persists those fields and staging proves the behavior.
 */
const SKU = /^(premium|premium_plus)_(monthly|yearly)$/;
const KEY = /^[A-Za-z0-9._~-]{16,128}$/;
const PROVIDER_ID = /^[A-Za-z0-9-]{8,128}$/;

export function createTrustedLocalSubscriptionReader({ fetchSubscriptions }) {
  if (typeof fetchSubscriptions !== 'function') {
    throw new Error('Trusted local Subscription database reader unavailable');
  }
  return async function verifyPersistedSubscription(intent) {
    if (!intent || typeof intent.intentId !== 'string' || !intent.intentId
      || typeof intent.accountId !== 'string' || !intent.accountId.trim()
      || !['paypal', 'wix'].includes(intent.provider)
      || typeof intent.sku !== 'string' || !SKU.test(intent.sku)
      || typeof intent.requestKey !== 'string' || !KEY.test(intent.requestKey)
      || typeof intent.providerRequestId !== 'string'
      || !KEY.test(intent.providerRequestId)
      || typeof intent.providerId !== 'string'
      || !PROVIDER_ID.test(intent.providerId)) {
      throw new Error('Local subscription verification intent invalid');
    }
    const providerField = intent.provider === 'paypal' ? 'subscription_id' : 'checkout_id';
    // The trusted reader must perform a server-side exact-match filter; only
    // two records are needed to detect ambiguity. Never select the latest row.
    const filters = {
      user_id: intent.accountId,
      provider: intent.provider,
      [providerField]: intent.providerId,
    };
    const records = await fetchSubscriptions(filters, '-created_date', 2);
    if (!Array.isArray(records) || records.length !== 1) {
      throw new Error('Unique persisted subscription record unverified');
    }
    const record = records[0];
    if (!record || typeof record !== 'object'
      || typeof record.id !== 'string' || !record.id
      || record.user_id !== intent.accountId
      || record.provider !== intent.provider
      || record.sku !== intent.sku
      || record[providerField] !== intent.providerId
      || record.checkout_intent_id !== intent.intentId
      || record.checkout_request_key !== intent.requestKey
      || record.checkout_provider_request_id !== intent.providerRequestId) {
      throw new Error('Persisted subscription identity unverified');
    }
    // A successful exact read proves presence of the record, not payment
    // activation, entitlement, webhook authenticity or safe provider creation.
    return Object.freeze({
      verified: true,
      intentId: intent.intentId,
      accountId: intent.accountId,
      provider: intent.provider,
      sku: intent.sku,
      requestKey: intent.requestKey,
      providerRequestId: intent.providerRequestId,
      providerId: intent.providerId,
    });
  };
}
