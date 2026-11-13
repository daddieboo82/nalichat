import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const source = () => readFile('base44/functions/checkSubscriptionStatus/entry.ts', 'utf8');

describe('stale active PayPal subscription reconciliation', () => {
  it('selects expired active PayPal records as well as pending records', async () => {
    const code = await source();
    expect(code).toContain("subscription.status === 'pending'");
    expect(code).toContain("subscription.status !== 'active'");
    expect(code).toContain("periodEndMs <= nowMs");
    expect(code).toContain("Number(right.status === 'active') - Number(left.status === 'active')");
  });

  it('requires a successful provider lookup and never grants an unbounded period', async () => {
    const code = await source();
    expect(code).toContain('if (!response.ok) continue;');
    expect(code).toContain('const status = paypalStatus(remoteStatus);');
    expect(code).toContain("status === 'active'");
    expect(code).toContain('periodEnd === null || periodEnd === undefined');
    expect(code).toContain('delete update.current_period_end;');
    expect(code).not.toContain('update.current_period_end = null;');
    expect(code.indexOf('if (!response.ok) continue;')).toBeLessThan(code.indexOf('delete update.current_period_end;'));
    expect(code).toContain('await subscriptionEntity.update(subscription.id as string, update);');
  });

  it('leaves scheduled pending subscriptions unchanged without a future billing boundary', async () => {
    for (const path of [
      'base44/functions/reconcilePendingPayPal/entry.ts',
      'base44/functions/reconcilePendingPayPal/main.ts',
    ]) {
      const code = await readFile(path, 'utf8');
      expect(code).toContain("status === 'active' && (typeof periodEnd !== 'string' || Date.parse(periodEnd) <= Date.now())");
      expect(code).toContain("result: 'needs_billing_period_verification'");
      expect(code.indexOf("result: 'needs_billing_period_verification'")).toBeLessThan(
        code.indexOf('await base44.asServiceRole.entities.Subscription.update(subscription.id, update)')
      );
    }
  });

  it('keeps incomplete webhook activations retryable rather than granting access', async () => {
    const code = await readFile('base44/functions/paypalWebhook/entry.ts', 'utf8');
    expect(code).toContain('requiresPayPalBillingVerification(record.status, newStatus, periodEnd)');
    expect(code).toContain("processing_state: 'failed'");
    expect(code).toContain("status: 503");
    expect(code).toContain("newStatus === 'active' && periodEnd === null");
    expect(code.indexOf('requiresPayPalBillingVerification(record.status, newStatus, periodEnd)')).toBeLessThan(
      code.indexOf('await entities.Subscription.update(record.id, update)')
    );
  });

  it('does not activate pending records in on-demand status checks without a future billing date', async () => {
    const code = await source();
    expect(code).toContain("subscription.status === 'pending' && status === 'active'");
    expect(code).toContain("typeof periodEnd !== 'string' || Date.parse(periodEnd) <= nowMs");
  });

  it('does not promote an existing checkout to active without a provider billing period', async () => {
    const code = await readFile('base44/functions/createPayPalSubscription/entry.ts', 'utf8');
    expect(code).toContain("typeof periodEnd !== 'string' || Date.parse(periodEnd) <= Date.now()");
    expect(code).toContain('PayPal subscription is active but its billing period requires verification');
    expect(code).toContain('current_period_end: periodEnd');
    expect(code.indexOf("typeof periodEnd !== 'string' || Date.parse(periodEnd) <= Date.now()")).toBeLessThan(
      code.indexOf("current_period_end: periodEnd")
    );
  });

  it('keeps failed provider verification from granting paid access', async () => {
    const code = await source();
    expect(code).toContain('if (!token) return;');
    expect(code).toContain('if (!status) continue;');
    expect(code).toContain('console.error(\'PayPal status reconciliation failed\', error)');
    expect(code).toContain('hasPaidTierAccess(status, {');
  });
});
