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

  it('handles an already active PayPal subscription without starting a second checkout', async () => {
    const createSource = await read('base44/functions/createPayPalSubscription/entry.ts');
    expect(createSource).toContain("remoteStatus === 'ACTIVE'");
    expect(createSource).toContain('This account already has a paid subscription; use the billing portal');
  });

  it('returns PayPal buyers to the canonical domain instead of the request host', async () => {
    const createSource = await read('base44/functions/createPayPalSubscription/entry.ts');
    expect(createSource).toContain("new URL('/ThankYou?subscription=1', APP_BASE_URL)");
    expect(createSource).toContain("new URL('/pricing', APP_BASE_URL)");
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

  it('uses dynamic or active app ID for PayPal webhook registration URL', async () => {
    const webhookSetupSource = await read('base44/functions/setupPayPalWebhook/entry.ts');
    const appParams = await read('src/lib/app-params.js');
    expect(webhookSetupSource).toContain("secrets.get('BASE44_APP_ID') || 'cbef744a8545c389ef439ea6'");
    expect(webhookSetupSource).not.toContain('6a1f5ee134147461560c2b37');
    expect(appParams).toContain("VITE_BASE44_APP_ID || 'cbef744a8545c389ef439ea6'");
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
