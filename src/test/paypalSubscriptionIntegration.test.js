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
      'base44/functions/createPayPalSubscription/entry.ts',
    ];
    for (const file of callers) {
      const source = await read(file);
      expect(source).toContain('resolvePayPalSubscriptionStatus');
      expect(source).toContain('paypalPeriodEndForStatus');
    }

    const statusSource = await read('base44/functions/checkSubscriptionStatus/entry.ts');
    expect(statusSource).toContain('update.cancel_at_period_end = false');
  });

  it('requires confirmed PayPal ACTIVE after an accepted activation request', async () => {
    const helper = await read('base44/shared/paypalSubscription.ts');
    expect(helper).toContain("if (freshStatus === 'ACTIVE')");
    expect(helper).toContain("remoteStatus = 'ACTIVE'");
    expect(helper).toContain('fresh?.id === subscriptionId && fresh?.plan_id === remote?.plan_id');
    expect(helper).not.toContain("if (activated) remoteStatus = 'ACTIVE'");
    expect(helper.indexOf("if (freshStatus === 'ACTIVE')")).toBeLessThan(
      helper.indexOf("remoteStatus = 'ACTIVE'"),
    );
  });

  it('verifies signed webhook agreement identity before applying the current PayPal state', async () => {
    const webhook = await read('base44/functions/paypalWebhook/entry.ts');
    expect(webhook).toContain('const remoteSubscription = await fetchVerifiedSubscription(token, subscriptionId, record)');
    expect(webhook).toContain('remote?.id !== subscriptionId || remote?.plan_id !== record.paypal_plan_id');
    expect(webhook).toContain('PayPal subscription verification mismatch');
    expect(webhook).toContain("remoteStatus === 'ACTIVE' ? 'active'");
    expect(webhook).toContain('Payment reversal needs independent transaction review');
    expect(webhook).not.toContain("const newStatus = state(event.event_type, event.resource)");
    expect(webhook.indexOf('const remoteSubscription = await fetchVerifiedSubscription')).toBeLessThan(
      webhook.indexOf('await entities.Subscription.update(record.id, update)'),
    );
  });

  it('retries signed payment events that lack an agreement reference instead of discarding them', async () => {
    const webhook = await read('base44/functions/paypalWebhook/entry.ts');
    const start = webhook.indexOf("if (!subscriptionId || typeof subscriptionId !== 'string')");
    const finish = webhook.indexOf("const records = await entities.Subscription.filter", start);
    expect(start).toBeGreaterThan(-1);
    expect(finish).toBeGreaterThan(start);
    const branch = webhook.slice(start, finish);
    expect(branch).toContain("processing_state: 'failed'");
    expect(branch).toContain("status: 503");
    expect(branch).toContain('Missing PayPal subscription reference');
    expect(branch).not.toContain("processing_state: 'ignored'");
  });

  it('persists PayPal refund/reversal as a visible manual-review state', async () => {
    const webhook = await read('base44/functions/paypalWebhook/entry.ts');
    const ledger = await read('base44/shared/paypalWebhookLedger.ts');
    const schema = await read('base44/entities/PayPalWebhookEvent.jsonc');
    const audit = await read('base44/functions/getPendingPayPalAudit/entry.ts');
    const dashboard = await read('src/pages/AdminDashboard.jsx');
    expect(webhook).toContain("processing_state: 'review_required'");
    expect(webhook).toContain("Payment reversal needs independent transaction review");
    expect(ledger).toContain("state === 'review_required'");
    expect(schema).toContain('"review_required"');
    expect(audit).toContain("{ processing_state: 'review_required' }");
    expect(audit).toContain('reviewRequiredCount, hasMoreReviewEvents, results');
    expect(dashboard).toContain('paypalAudit.reviewRequiredCount');
    expect(dashboard).toContain('PayPal refund/reversal events require manual review');
  });

  it('handles an already active PayPal subscription without starting a second checkout', async () => {
    const createSource = await read('base44/functions/createPayPalSubscription/entry.ts');
    expect(createSource).toContain("remoteStatus === 'ACTIVE'");
    expect(createSource).toContain('This account already has a paid subscription; use the billing portal');
  });

  it('verifies the provider agreement, plan, and account binding before checkout resume activation', async () => {
    const source = await read('base44/functions/createPayPalSubscription/entry.ts');
    const identityGuard = source.indexOf('remote?.id !== pending.subscription_id');
    const planGuard = source.indexOf('remote?.plan_id !== planId', identityGuard);
    const ownershipGuard = source.indexOf("remote?.custom_id !== user.id + ':' + sku", identityGuard);
    const resolver = source.indexOf('const remoteStatus = await resolvePayPalSubscriptionStatus', identityGuard);
    expect(identityGuard).toBeGreaterThan(-1);
    expect(planGuard).toBeGreaterThan(identityGuard);
    expect(ownershipGuard).toBeGreaterThan(planGuard);
    expect(resolver).toBeGreaterThan(ownershipGuard);
    expect(source).toContain('PayPal checkout resume identity mismatch; existing agreement not applied');
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

  it('fails closed rather than registering PayPal webhooks against a fallback app', async () => {
    const webhookSetupSource = await read('base44/functions/setupPayPalWebhook/entry.ts');
    expect(webhookSetupSource).toContain("secrets.get('BASE44_APP_ID')");
    expect(webhookSetupSource).toContain("secrets.get('PAYPAL_WEBHOOK_URL')");
    expect(webhookSetupSource).not.toContain("secrets.get('BASE44_APP_ID') || 'cbef744a8545c389ef439ea6'");
    expect(webhookSetupSource).toContain('Set the current BASE44_APP_ID before registering a PayPal webhook');
    expect(webhookSetupSource).toContain('Webhook URL does not match the configured Base44 app');
    expect(webhookSetupSource).toContain("parsedWebhookUrl.protocol !== 'https:'");
    expect(webhookSetupSource).toContain("parsedWebhookUrl.hostname !== 'base44-dispatcher-production.base44.workers.dev'");
    expect(webhookSetupSource.indexOf('const configuredAppId =')).toBeLessThan(
      webhookSetupSource.indexOf('const accessToken = await token()'),
    );
  });

  it('checks an existing PayPal webhook against authenticated provider configuration before reuse', async () => {
    const source = await read('base44/functions/setupPayPalWebhook/entry.ts');
    expect(source).not.toContain("return Response.json({ success: true, reused: true, webhookId: existing })");
    expect(source).toContain("'/v1/notifications/webhooks/' + encodeURIComponent(existing)");
    expect(source).toContain("remote?.id !== existing || remote?.url !== webhookUrl");
    expect(source).toContain("EVENTS.every((eventName) => remoteEvents.has(eventName))");
    expect(source).toContain('Unable to verify existing PayPal webhook');
    expect(source).toContain('Existing PayPal webhook destination or event types do not match this app');
    expect(source.indexOf('if (existing && !existing.startsWith')).toBeGreaterThan(
      source.indexOf('const accessToken = await token()'),
    );
    expect(source).toContain('success: true, reused: true, verified: true');
  });

  it('does not create an untracked PayPal webhook without durable ID persistence', async () => {
    const source = await read('base44/functions/setupPayPalWebhook/entry.ts');
    expect(source).not.toContain("fetch(apiBase() + '/v1/notifications/webhooks', {");
    expect(source).toContain('PayPal webhook registration requires controlled provisioning and persisted webhook ID');
    expect(source).toContain('status: 503');
    expect(source).toContain("'/v1/notifications/webhooks/' + encodeURIComponent(existing)");
  });

  it('does not treat a stored webhook ID as verified PayPal billing readiness', async () => {
    for (const path of [
      'base44/functions/getBillingTestStatus/entry.ts',
      'base44/functions/getBillingTestStatus/main.ts',
    ]) {
      const source = await read(path);
      expect(source).toContain('const webhookIdPresent = Boolean(');
      expect(source).toContain('const webhookConfigured = false;');
      expect(source).toContain('webhookIdPresent,');
      expect(source).toContain("webhookVerificationStatus: 'unverified'");
    }
  });

  it('does not request a PayPal token for webhook setup without a stored provider ID', async () => {
    const source = await read('base44/functions/setupPayPalWebhook/entry.ts');
    expect(source).toContain("if (!existing || existing.startsWith('REPLACE_'))");
    expect(source.indexOf("if (!existing || existing.startsWith('REPLACE_'))")).toBeLessThan(
      source.indexOf('const accessToken = await token()'),
    );
  });

  it('warns admins to reconcile missing PayPal agreements without restarting checkout', async () => {
    const dashboard = await read('src/pages/AdminDashboard.jsx');
    expect(dashboard).toContain('New recurring checkout is paused');
    expect(dashboard).toContain('Verify the provider environment, merchant account, and agreement');
    expect(dashboard).not.toContain('The customer must complete a new checkout before payment can be collected');
    expect(dashboard).toContain('PayPal webhook:');
    expect(dashboard).toContain('billingTestStatus?.webhookVerificationStatus === "verified"');
    expect(dashboard).toContain('billingTestStatus?.webhookConfigured');
  });

  it('does not present a truncated or unverified PayPal provider audit as complete', async () => {
    const backend = await read('base44/functions/getPendingPayPalAudit/entry.ts');
    const dashboard = await read('src/pages/AdminDashboard.jsx');
    expect(backend).toContain("'-created_date', 101");
    expect(backend).toContain('const hasMorePending = pendingPage.length > 100');
    expect(backend).toContain('const pending = pendingPage.slice(0, 100)');
    expect(backend).toContain('providerStatusVerified: knownStatus');
    expect(backend).toContain('verifiedCount: results.filter((result) => result.providerStatusVerified === true).length');
    expect(backend).toContain('hasMorePending, results');
    expect(dashboard).toContain('paypalAudit.hasMorePending');
    expect(dashboard).toContain('paypalAudit.verifiedCount');
    expect(dashboard).toContain('This report does not cover every pending agreement');
    expect(dashboard).toContain('Some provider statuses could not be verified');
  });

  it('counts PayPal status as verified only after agreement and plan identity checks', async () => {
    const audit = await read('base44/functions/getPendingPayPalAudit/entry.ts');
    const dashboard = await read('src/pages/AdminDashboard.jsx');
    expect(audit).toContain('remote.id !== record.subscription_id');
    expect(audit).toContain('remote.plan_id !== record.paypal_plan_id');
    expect(audit).toContain("status: 'identity_mismatch', providerStatusVerified: false");
    expect(audit).toContain('providerStatusVerified: knownStatus');
    expect(audit).toContain("['APPROVAL_PENDING', 'APPROVED', 'ACTIVE', 'SUSPENDED'");
    expect(dashboard).toContain('PayPal agreement or plan identity mismatch detected');
  });

  it('requires matching PayPal identity before pending reconciliation or activation', async () => {
    for (const path of [
      'base44/functions/reconcilePendingPayPal/entry.ts',
      'base44/functions/reconcilePendingPayPal/main.ts',
      'base44/functions/checkSubscriptionStatus/entry.ts',
    ]) {
      const source = await read(path);
      expect(source).toContain('remote?.plan_id !== subscription.paypal_plan_id');
      expect(source).toContain('subscription.paypal_environment !==');
      expect(source.indexOf('remote?.plan_id !== subscription.paypal_plan_id')).toBeLessThan(
        source.indexOf('const remoteStatus = await resolvePayPalSubscriptionStatus'),
      );
    }
    const helper = await read('base44/shared/paypalSubscription.ts');
    expect(helper).toContain('fresh?.id === subscriptionId && fresh?.plan_id === remote?.plan_id');
    const scheduled = await read('base44/functions/reconcilePendingPayPal/main.ts');
    expect(scheduled).toContain("result: 'provider_identity_mismatch'");
    const requestStatus = await read('base44/functions/checkSubscriptionStatus/entry.ts');
    expect(requestStatus).toContain('PayPal subscription identity mismatch; status not applied');
  });

  it('captures subscription_id for analytics deduplication on ThankYou return page', async () => {
    const thankYouSource = await read('src/pages/ThankYou.jsx');
    expect(thankYouSource).toContain('urlParams.get("subscription_id")');
    expect(thankYouSource).toContain('subscriptionId || "unknown"');
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
