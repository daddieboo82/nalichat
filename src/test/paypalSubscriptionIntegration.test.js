import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';

async function read(file) {
  return fs.readFile(file, 'utf8');
}

describe('PayPal subscription integration contracts', () => {
  it('activates APPROVED subscriptions and ignores elapsed billing times before granting access', async () => {
    const helper = await read('base44/shared/paypalSubscription.ts');
    expect(helper).toContain("remoteStatus !== 'APPROVED'");
    expect(helper).toContain('/activate');
    expect(helper).toContain("remoteStatus = 'ACTIVE'");
    expect(helper).toContain("status === 'active' && parsed <= nowMs");

    const callers = [
      'base44/functions/checkSubscriptionStatus/entry.ts',
      'base44/functions/reconcilePendingPayPal/entry.ts',
      'base44/functions/reconcilePendingPayPal/main.ts',
    ];
    for (const file of callers) {
      const source = await read(file);
      expect(source).toContain('resolvePayPalSubscriptionStatus');
      expect(source).toContain('paypalPeriodEndForStatus');
    }

    const statusSource = await read('base44/functions/checkSubscriptionStatus/entry.ts');
    expect(statusSource).toContain('update.cancel_at_period_end = false');
  });

  it('reserves a single PayPal agreement per account before provider creation', async () => {
    const createSource = await read('base44/functions/createPayPalSubscription/entry.ts');
    const userSchema = JSON.parse(await read('base44/entities/User.jsonc'));
    expect(userSchema.properties.paypal_checkout_claim_id.rls.read).toBe(false);
    expect(createSource).toContain('await users.update(userId, {');
    expect(createSource).toContain('await users.get(userId)');
    expect(createSource).not.toContain('users.updateMany(');
    expect(createSource).toContain('persisted?.paypal_checkout_claim_id === claimId');
    expect(createSource).toContain("const providerStatus = String(remote?.status || '').toUpperCase()");
    expect(createSource).toContain("['CANCELLED', 'EXPIRED'].includes(providerStatus)");
    expect(createSource).toContain("providerStatus === 'APPROVAL_PENDING'");
    expect(createSource.indexOf('const reserved = await reservePayPalCheckout('))
      .toBeLessThan(createSource.indexOf("const res = await fetch(apiBase() + '/v1/billing/subscriptions', {"));
    expect(createSource).toContain('checkout_request_key: idempotencyKey');
    expect(createSource).not.toContain('atomicCheckoutReservationIsImplemented');
  });

  it('classifies checkout dependency failures without risking duplicate PayPal subscriptions', async () => {
    const source = await read('base44/functions/createPayPalSubscription/entry.ts');
    expect(source).toContain("checkoutStage = 'load_subscriptions'");
    expect(source).toContain("checkoutStage = 'paypal_authentication'");
    expect(source).toContain("checkoutStage = 'reserve_checkout'");
    expect(source).toContain("checkoutStage = 'paypal_create_subscription'");
    expect(source).toContain("checkoutStage = 'persist_pending_subscription'");
    expect(source).toContain('Array.isArray(allSubsResult)');
    expect(source).toContain("res.json().catch(() => null)");
    expect(source).toContain('PAYPAL_CHECKOUT_UNCERTAIN');
    expect(source).toContain('CHECKOUT_DEPENDENCY_ERROR');
    expect(source).toContain('status: 503');
    expect(source).not.toContain('releasePayPalCheckoutClaim(');
  });

  it('uses PayPal-compatible, deterministic request IDs', async () => {
    const createSource = await read('base44/functions/createPayPalSubscription/entry.ts');
    const requestIdSource = await read('base44/shared/paypalCheckoutRequest.ts');
    expect(requestIdSource).toContain("crypto.subtle.digest('SHA-256', bytes)");
    expect(requestIdSource).toContain('.slice(0, 36)');
    expect(createSource).toContain("'PayPal-Request-Id': await paypalSubscriptionRequestId(user.id, sku)");
    expect(requestIdSource).toContain("userId + ':subscription:' + sku + ':' + day");
  });

  it('keeps pending PayPal approval recovery available after checkout cancellation', async () => {
    const ui = await read('src/components/pricing/PricingPlans.jsx');
    expect(ui).toContain('{subscription.hasPending && !subscription.hasPaidAccess && (');
    expect(ui).not.toContain('!checkoutCanceled && (');
    expect(ui).toContain('Continue existing PayPal approval');
    // Pending billing must stay blocked until on-demand provider verification
    // clears a terminal agreement. Never disable the fraud/duplicate guard.
    expect(ui).toContain('isCheckoutPaused={isAuthenticated && (isError || subscription.hasPending)}');
    const statusCheck = await read('base44/functions/checkSubscriptionStatus/entry.ts');
    expect(statusCheck).toContain('await reconcilePendingPayPal(subscriptionEntity, subs)');
    expect(statusCheck).toContain("if (subscription.provider !== 'paypal' || subscription.status !== 'pending') return false;");
    expect(statusCheck).toContain('subscription.paypal_environment !== paypalEnvironment');
  });

  it('keeps billing review reachable without initiating another PayPal checkout', async () => {
    const ui = await read('src/components/pricing/PricingPlans.jsx');
    expect(ui).toContain('isCheckoutPaused ? onBillingReview() : onSelect(plan.id)');
    expect(ui).toContain('onBillingReview={() => navigate("/settings")}');
    expect(ui).toContain('disabled={isStarting || isCurrent || isPaidSubscriber}');
    expect(ui).not.toContain('disabled={isStarting || isCurrent || isPaidSubscriber || isCheckoutPaused}');
    expect(ui).toContain('isCheckoutPaused={isAuthenticated && (isError || subscription.hasPending)}');
    expect(ui).toContain('if (subscription.hasPending) {');
    expect(ui).toContain('setCheckoutRecoveryNeeded(true)');
    expect(ui).toContain('await startSubscriptionCheckout({');
  });

  it('returns PayPal buyers to the canonical domain instead of the request host', async () => {
    const createSource = await read('base44/functions/createPayPalSubscription/entry.ts');
    expect(createSource).toContain("new URL('/ThankYou?subscription=1', APP_BASE_URL)");
    expect(createSource).toContain("new URL('/pricing?checkout=paypal_canceled', APP_BASE_URL)");
    expect(createSource).not.toContain("req.headers.get('X-Base44-App-Url')");
  });

  it('asks PayPal to retry a payment event that arrives before the local record exists', async () => {
    const webhook = await read('base44/functions/paypalWebhook/entry.ts');
    expect(webhook).toContain("processing_state: 'failed'");
    expect(webhook).toContain('Subscription record not ready');
    expect(webhook).toContain('status: 503');
    expect(webhook).toContain('paypalPeriodEndForStatus');
  });

  it('ignores REPLACE_ placeholder secrets in test status and plan setup', async () => {
    const billingTestEntry = await read('base44/functions/getBillingTestStatus/entry.ts');
    const billingTestMain = await read('base44/functions/getBillingTestStatus/main.ts');
    const plansSource = await read('base44/functions/setupPayPalPlans/entry.ts');
    const webhookSetupSource = await read('base44/functions/setupPayPalWebhook/entry.ts');

    expect(billingTestEntry).toContain("value.startsWith('REPLACE_')");
    expect(billingTestMain).toContain("value.startsWith('REPLACE_')");
    expect(plansSource).toContain("!id.startsWith('REPLACE_')");
    expect(webhookSetupSource).toContain("!existing.startsWith('REPLACE_')");
  });

  it('registers the PayPal webhook on the app public function endpoint', async () => {
    const webhookSetupSource = await read('base44/functions/setupPayPalWebhook/entry.ts');
    const appParams = await read('src/lib/app-params.js');
    // PayPal deliveries must land on the public function URL. The internal
    // dispatcher endpoint rejects unauthenticated provider calls, so every event
    // registered there was dropped before it reached the handler.
    expect(webhookSetupSource).toContain('https://nalichat.base44.app/functions/paypalWebhook');
    expect(webhookSetupSource).not.toContain('base44-dispatcher-production');
    expect(appParams).toContain("VITE_BASE44_APP_ID || '6a1f5ee134147461560c2b37'");
    expect(appParams).not.toContain('cbef744a8545c389ef439ea6');
  });

  it('captures subscription_id for analytics deduplication on ThankYou return page', async () => {
    const thankYouSource = await read('src/pages/ThankYou.jsx');
    expect(thankYouSource).toContain('urlParams.get("subscription_id")');
    // Dedupe keys use only provider-verified agreement evidence, never "unknown".
    expect(thankYouSource).toContain('const analyticsKey = verifiedTransactionKey');
    expect(thankYouSource).not.toContain('subscriptionId || "unknown"');
    expect(thankYouSource).toContain('Sign in to confirm access');
    expect(thankYouSource).toContain('login?returnTo=');
  });

  it('redirects the previous public host to nalichat.org and keeps the PayPal return query', async () => {
    const html = await read('index.html');
    const main = await read('src/main.jsx');
    expect(html).toContain('nalichat.base44.app');
    expect(html).toContain('www.nalichat.org');
    expect(html).toContain('https://nalichat.org');
    expect(html).toContain('location.pathname + location.search + location.hash');
    expect(main).toContain('redirectLegacyHost(window.location)');
  });
});