/**
 * Draft PayPal terminal status verification policy. NOT a billing route.
 * Requires a trusted server-side PayPal subscription GET implementation,
 * authenticated independently by the checkout worker.
 *
 * Only EXPIRED is treated as terminal. CANCELLED can retain paid entitlement
 * through the billing period; SUSPENDED can recover; unknown outcomes block.
 * The expected plan ID must come from trusted backend SKU configuration, never a
 * browser parameter or untrusted checkout record. This helper does NOT verify
 * webhook signatures or grant/revoke entitlements.
 * Wix is intentionally unsupported until an independently authenticated
 * provider outcome reader exists.
 */
export async function verifyPayPalTerminalCheckout(intent, readPayPalSubscription, expectedPlanId) {
  if (!intent || intent.provider !== 'paypal'
    || typeof intent.intentId !== 'string' || !intent.intentId
    || typeof intent.accountId !== 'string' || !intent.accountId
    || intent.accountId.includes(':')
    || !/^(premium|premium_plus)_(monthly|yearly)$/.test(intent.sku)
    || typeof intent.providerRequestId !== 'string' || !intent.providerRequestId
    || typeof intent.providerId !== 'string'
    || !/^[A-Za-z0-9-]{8,128}$/.test(intent.providerId)
    || typeof readPayPalSubscription !== 'function'
    || typeof expectedPlanId !== 'string'
    || !/^[A-Za-z0-9-]{8,128}$/.test(expectedPlanId)) {
    throw new Error('Trusted PayPal terminal verification unavailable');
  }
  // The remote result must be fetched by the trusted worker from PayPal's
  // subscription read endpoint, never accepted from client-provided JSON.
  const remote = await readPayPalSubscription(intent.providerId);
  if (!remote || typeof remote !== 'object'
    || remote.id !== intent.providerId
    || remote.custom_id !== intent.accountId + ':' + intent.sku
    || remote.plan_id !== expectedPlanId
    || typeof remote.status !== 'string') {
    throw new Error('PayPal subscription identity or status unverified');
  }
  // Approvals, active, suspended and cancelled subscriptions are NOT enough
  // to unlock an account, since some may still have entitlement or recover.
  if (remote.status.toUpperCase() !== 'EXPIRED') {
    throw new Error('PayPal subscription not verified terminal');
  }
  return Object.freeze({
    verified: true,
    terminal: true,
    intentId: intent.intentId,
    accountId: intent.accountId,
    provider: 'paypal',
    providerRequestId: intent.providerRequestId,
  });
}

/** Explicit fail-closed stand-in until a trusted Wix subscription reader exists. */
export async function verifyWixTerminalCheckout() {
  throw new Error('Trusted Wix terminal verification unavailable');
}
