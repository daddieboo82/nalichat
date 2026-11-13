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

  it('revalidates active PayPal subscriptions with absent or malformed billing ends', async () => {
    const code = await source();
    expect(code).toContain("subscription.status !== 'active'");
    expect(code).toContain("typeof subscription.current_period_end === 'string'");
    expect(code).toContain('Number.NaN');
    expect(code).toContain('!Number.isFinite(periodEndMs) || periodEndMs <= nowMs');
    expect(code.indexOf('!Number.isFinite(periodEndMs) || periodEndMs <= nowMs'))
      .toBeLessThan(code.indexOf('.slice(0, 10)'));
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

  it('isolates scheduled provider failures to one subscription rather than aborting the batch', async () => {
    for (const path of [
      'base44/functions/reconcilePendingPayPal/entry.ts',
      'base44/functions/reconcilePendingPayPal/main.ts',
    ]) {
      const code = await readFile(path, 'utf8');
      const loopStart = code.indexOf('for (const subscription of pending)');
      const rowCatch = code.indexOf("result: 'record_failed'");
      const batchReturn = code.indexOf("action: 'reconcile_pending_paypal'");
      expect(loopStart, path).toBeGreaterThan(0);
      expect(code.slice(loopStart, rowCatch), path).toContain('try {');
      expect(rowCatch, path).toBeGreaterThan(loopStart);
      expect(batchReturn, path).toBeGreaterThan(rowCatch);
      expect(code, path).toContain("console.error('PayPal per-subscription reconciliation failed', error)");
    }
  });

  it('continues authenticated PayPal checks after a per-record exception', async () => {
    const code = await source();
    const loopStart = code.indexOf('for (const subscription of candidates)');
    const rowCatch = code.indexOf("console.error('PayPal subscription lookup or update failed', error)");
    const outerCatch = code.indexOf("console.error('PayPal status reconciliation failed', error)");
    expect(loopStart).toBeGreaterThan(0);
    expect(rowCatch).toBeGreaterThan(loopStart);
    expect(outerCatch).toBeGreaterThan(rowCatch);
    expect(code.slice(loopStart, rowCatch)).toContain('try {');
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

  it('requires current provider ACTIVE status and matching plan for a pending webhook activation', async () => {
    const code = await readFile('base44/functions/paypalWebhook/entry.ts', 'utf8');
    expect(code).toContain("record.status === 'pending' && newStatus === 'active'");
    expect(code).toContain("remoteSubscription?.status !== 'ACTIVE'");
    expect(code).toContain("remoteSubscription.planId !== record.paypal_plan_id");
    expect(code).toContain('providerMismatch || requiresPayPalBillingVerification');
    expect(code.indexOf("remoteSubscription?.status !== 'ACTIVE'")).toBeLessThan(
      code.indexOf('await entities.Subscription.update(record.id, update)')
    );
  });

  it('uses fresh provider billing date instead of event date for pending activation', async () => {
    const code = await readFile('base44/functions/paypalWebhook/entry.ts', 'utf8');
    expect(code).toContain('const billingTime = needsCurrentProviderStatus');
    expect(code).toContain('? remoteSubscription?.nextBillingTime');
    expect(code).toContain('const providerMismatch = needsCurrentProviderStatus');
    expect(code.indexOf('const billingTime = needsCurrentProviderStatus')).toBeLessThan(
      code.indexOf('requiresPayPalBillingVerification(record.status, newStatus, periodEnd)')
    );
  });

  it('does not activate pending records in on-demand status checks without a future billing date', async () => {
    const code = await source();
    expect(code).toContain("subscription.status === 'pending' && status === 'active'");
    expect(code).toContain("typeof periodEnd !== 'string' || Date.parse(periodEnd) <= nowMs");
  });

  it('checks existing paid access before returning an old Stripe checkout URL', async () => {
    const code = await readFile('base44/functions/createSubscriptionCheckout/entry.ts', 'utf8');
    const paidCheck = code.indexOf('const existingPaidSubscription = subscriptions.find');
    const firstReuse = code.indexOf('pendingSubscription?.checkout_url');
    expect(paidCheck).toBeGreaterThan(0);
    expect(firstReuse).toBeGreaterThan(paidCheck);
    expect(code.slice(paidCheck, firstReuse)).toContain('if (existingPaidSubscription)');
  });

  it('checks unresolved PayPal before reusing an existing Stripe checkout', async () => {
    const code = await readFile('base44/functions/createSubscriptionCheckout/entry.ts', 'utf8');
    const guardPosition = code.indexOf('const unresolvedPayPal = subscriptions.some');
    const earlyReusePosition = code.indexOf('pendingSubscription?.checkout_url');
    expect(guardPosition).toBeGreaterThan(0);
    expect(earlyReusePosition).toBeGreaterThan(guardPosition);
    expect(code).toContain('Existing PayPal subscription needs verification before another checkout');
  });

  it('blocks cross-provider checkout on unresolved active PayPal renewal', async () => {
    for (const path of [
      'base44/functions/createSubscriptionCheckout/entry.ts',
      'base44/functions/create-checkout/entry.ts',
    ]) {
      const code = await readFile(path, 'utf8');
      expect(code).toContain('requiresExistingPayPalCheckoutReview(');
      expect(code).toContain('Existing PayPal subscription needs verification before another checkout');
      expect(code).toContain('status: 409');
    }
  });

  it('paginates all subscriber records before PayPal and Wix duplicate-billing checks', async () => {
    for (const path of [
      'base44/functions/createPayPalSubscription/entry.ts',
      'base44/functions/create-checkout/entry.ts',
    ]) {
      const code = await readFile(path, 'utf8');
      expect(code, path).toContain('async function loadUserSubscriptions(entity: any, userId: string)');
      expect(code, path).toContain('for (let skip = 0; ; skip += pageSize)');
      expect(code, path).toContain("'-created_date', pageSize, skip");
      expect(code, path).toContain('if (page.length < pageSize) return rows;');
      const load = code.indexOf('const allSubs = await loadUserSubscriptions(');
      const existing = code.indexOf('const alreadyPaid = allSubs.some');
      expect(load, path).toBeGreaterThan(0);
      expect(existing, path).toBeGreaterThan(load);
      expect(code, path).not.toContain("{ user_id: user.id }, '-created_date', 100,");
    }
  });

  it('blocks a second PayPal checkout for an unresolved existing active subscription', async () => {
    const code = await readFile('base44/functions/createPayPalSubscription/entry.ts', 'utf8');
    expect(code).toContain("const unresolvedActivePayPal = allSubs.some");
    expect(code).toContain("const undatedActivePayPal = allSubs.some");
    expect(code).toContain("An existing PayPal subscription requires status verification before another checkout");
    expect(code.indexOf("An existing PayPal subscription requires status verification before another checkout")).toBeLessThan(
      code.indexOf("const res = await fetch(apiBase() + '/v1/billing/subscriptions'")
    );
  });

  it('does not create another PayPal agreement while an older pending agreement is unresolved', async () => {
    const code = await readFile('base44/functions/createPayPalSubscription/entry.ts', 'utf8');
    expect(code).toContain("const existing = allSubs.filter((sub: any)");
    expect(code).toContain("sub.provider === 'paypal' && sub.status === 'pending'");
    expect(code).toContain('Could not verify the previous PayPal checkout');
    expect(code).toContain('Existing PayPal checkout requires verification before another subscription');
    expect(code).toContain('Existing PayPal approval URL is invalid');
    expect(code).not.toContain("status: 'pending', sku }, '-created_date', 20");
    const lookupFailure = code.indexOf('Could not verify the previous PayPal checkout');
    const createRequest = code.indexOf("const res = await fetch(apiBase() + '/v1/billing/subscriptions'");
    expect(lookupFailure).toBeGreaterThan(0);
    expect(createRequest).toBeGreaterThan(lookupFailure);
  });

  it('verifies stale ACTIVE PayPal records before using activation-capable status helper', async () => {
    const code = await source();
    const remoteRead = code.indexOf('const remote = await response.json();');
    const ownership = code.indexOf("remote?.custom_id !== subscription.user_id + ':' + subscription.sku");
    const resolver = code.indexOf('const remoteStatus = await resolvePayPalSubscriptionStatus(');
    expect(remoteRead).toBeGreaterThan(0);
    expect(ownership).toBeGreaterThan(remoteRead);
    expect(resolver).toBeGreaterThan(ownership);
    const verification = code.slice(remoteRead, resolver);
    expect(verification).toContain("remote?.plan_id !== subscription.paypal_plan_id");
    expect(verification).not.toContain("subscription.status === 'pending' &&");
  });

  it('checks PayPal owner and plan before any APPROVED activation in all callers', async () => {
    for (const path of [
      'base44/functions/createPayPalSubscription/entry.ts',
      'base44/functions/checkSubscriptionStatus/entry.ts',
      'base44/functions/reconcilePendingPayPal/entry.ts',
      'base44/functions/reconcilePendingPayPal/main.ts',
    ]) {
      const code = await readFile(path, 'utf8');
      const lookup = code.indexOf('const remote = await ');
      const ownerCheck = code.indexOf("remote?.custom_id !== ");
      const activation = code.indexOf('const remoteStatus = await resolvePayPalSubscriptionStatus(');
      expect(lookup, path).toBeGreaterThan(0);
      expect(ownerCheck, path).toBeGreaterThan(lookup);
      expect(activation, path).toBeGreaterThan(ownerCheck);
      expect(code, path).toContain("remote?.plan_id !== ");
    }
  });

  it('verifies PayPal plan and owner before updating a resumed active subscription', async () => {
    const code = await readFile('base44/functions/createPayPalSubscription/entry.ts', 'utf8');
    const check = code.indexOf("remote?.plan_id !== planId || remote?.custom_id !== user.id + ':' + sku");
    const write = code.indexOf("await base44.asServiceRole.entities.Subscription.update(pending.id");
    expect(check).toBeGreaterThan(0);
    expect(write).toBeGreaterThan(check);
    expect(code).toContain('PayPal subscription ownership or plan could not be verified');
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
    expect(code).toContain('hasPaidTierAccess(accessStatus, {');
  });
});
