import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { shouldApplyPayPalEvent } from '../../base44/shared/paypalWebhookLedger.ts';

const source = () => readFile('base44/functions/checkSubscriptionStatus/entry.ts', 'utf8');

describe('signed PayPal webhook event ordering', () => {
  const newer = '2026-11-13T17:00:00.000Z';
  const older = '2026-11-12T17:00:00.000Z';

  it('rejects an invalid incoming timestamp rather than treating it as newest', () => {
    expect(shouldApplyPayPalEvent('last', newer, 'next', '')).toBe(false);
    expect(shouldApplyPayPalEvent('last', newer, 'next', 'not-a-date')).toBe(false);
    expect(shouldApplyPayPalEvent(null, null, 'first', 'not-a-date')).toBe(false);
  });

  it('rejects implausibly future-dated events before they can outrank later events', () => {
    const now = Date.parse('2026-11-13T17:00:00.000Z');
    expect(shouldApplyPayPalEvent(null, null, 'future',
      '2026-11-13T17:05:01.000Z', now)).toBe(false);
    expect(shouldApplyPayPalEvent(null, null, 'skew',
      '2026-11-13T17:04:59.000Z', now)).toBe(true);
  });

  it('rejects stale or duplicate events while allowing newer valid events', () => {
    expect(shouldApplyPayPalEvent('last', newer, 'last', newer)).toBe(false);
    expect(shouldApplyPayPalEvent('last', newer, 'older', older)).toBe(false);
    expect(shouldApplyPayPalEvent('last', newer, 'different-same-time', newer)).toBe(false);
    expect(shouldApplyPayPalEvent('last', older, 'next', newer)).toBe(true);
  });

  it('rejects unordered legacy recorded event history without losing first-event recovery', () => {
    expect(shouldApplyPayPalEvent('old-event', null, 'new-event',
      '2026-11-13T17:00:00.000Z')).toBe(false);
    expect(shouldApplyPayPalEvent('old-event', 'invalid', 'new-event',
      '2026-11-13T17:00:00.000Z')).toBe(false);
    expect(shouldApplyPayPalEvent(null, null, 'new-event',
      '2026-11-13T17:00:00.000Z')).toBe(true);
  });

  it('retains missing legacy event timestamps as retryable reconciliation failures', async () => {
    const code = await readFile('base44/functions/paypalWebhook/entry.ts', 'utf8');
    const guard = code.indexOf('!Number.isFinite(lastEventTimeMs)');
    const equalTime = code.indexOf('lastEventTimeMs === eventCreatedAt');
    expect(guard).toBeGreaterThan(0);
    expect(equalTime).toBeGreaterThan(guard);
    const conflict = code.slice(guard, equalTime);
    expect(conflict).toContain("processing_state: 'failed'");
    expect(conflict).toContain('Recorded PayPal event timestamp requires reconciliation');
    expect(conflict).toContain('status: 503');
  });

  it('keeps late refunds/reversals reviewable even after a newer lifecycle event', async () => {
    const code = await readFile('base44/functions/paypalWebhook/entry.ts', 'utf8');
    const adjustment = code.indexOf('const lateFinancialAdjustment = (');
    const genericStale = code.indexOf('!shouldApplyPayPalEvent(');
    expect(adjustment).toBeGreaterThan(0);
    expect(genericStale).toBeGreaterThan(adjustment);
    const path = code.slice(adjustment, genericStale);
    expect(path).toContain("'PAYMENT.SALE.REFUNDED'");
    expect(path).toContain("'PAYMENT.SALE.REVERSED'");
    expect(path).toContain('eventCreatedAt < lastEventTimeMs');
    expect(path).toContain("processing_state: 'failed'");
    expect(path).toContain('reviewRequired: true');
    expect(path).toContain('status: 503');
    expect(path).not.toContain('Subscription.update(');
    expect(path).not.toContain("processing_state: 'ignored'");
  });

  it('keeps different equal-timestamp lifecycle events retryable instead of ignored', async () => {
    const code = await readFile('base44/functions/paypalWebhook/entry.ts', 'utf8');
    const guard = code.indexOf('lastEventTimeMs === eventCreatedAt');
    const genericStaleCheck = code.indexOf('!shouldApplyPayPalEvent(');
    expect(guard).toBeGreaterThan(0);
    expect(genericStaleCheck).toBeGreaterThan(guard);
    const handling = code.slice(guard, genericStaleCheck);
    expect(handling).toContain("processing_state: 'failed'");
    expect(handling).toContain('Same-timestamp PayPal events require provider reconciliation');
    expect(handling).toContain('status: 503');
    expect(handling).not.toContain("processing_state: 'ignored'");
  });

  it('requires a valid signed creation time before the webhook ledger is touched', async () => {
    const code = await readFile('base44/functions/paypalWebhook/entry.ts', 'utf8');
    const verification = code.indexOf('if (!(await verify(req, event, token)))');
    const timeGuard = code.indexOf("const eventCreatedAt = typeof event.create_time === 'string'");
    const ledger = code.indexOf('const existing = await entities.PayPalWebhookEvent.filter(');
    expect(verification).toBeGreaterThan(0);
    expect(timeGuard).toBeGreaterThan(verification);
    expect(ledger).toBeGreaterThan(timeGuard);
    expect(code.slice(timeGuard, ledger)).toContain('eventCreatedAt > Date.now() + 5 * 60_000');
    expect(code).toContain("event_time: event.create_time,");
    expect(code).toContain('const incomingEventTime = event.create_time;');
    expect(code).not.toContain('event.create_time || new Date().toISOString()');
  });
});

describe('stale active PayPal subscription reconciliation', () => {
  it('selects expired active PayPal records as well as pending records', async () => {
    const code = await source();
    expect(code).toContain("subscription.status === 'pending'");
    expect(code).toContain("subscription.status !== 'active'");
    expect(code).toContain("periodEndMs <= nowMs");
    expect(code).toContain("const staleActive = unresolved.filter");
    expect(code).toContain("const pending = unresolved.filter");
    expect(code).toContain('...selectRotating(staleActive, 5)');
    expect(code).toContain('...selectRotating(pending, 5)');
  });

  it('revalidates active PayPal subscriptions with absent or malformed billing ends', async () => {
    const code = await source();
    expect(code).toContain("subscription.status !== 'active'");
    expect(code).toContain("typeof subscription.current_period_end === 'string'");
    expect(code).toContain('Number.NaN');
    expect(code).toContain('!Number.isFinite(periodEndMs) || periodEndMs <= nowMs');
    expect(code.indexOf('!Number.isFinite(periodEndMs) || periodEndMs <= nowMs'))
      .toBeLessThan(code.indexOf('const staleActive = unresolved.filter'));
  });

  it('rotates pending and stale active retries so one group cannot starve the other', async () => {
    const code = await source();
    expect(code).toContain('Math.floor(nowMs / 60_000) % rows.length');
    expect(code).toContain('const selectedIds = new Set(candidates.map((row) => row.id))');
    expect(code).toContain('candidates.push(...selectRotating(remaining, 10 - candidates.length))');
    expect(code).not.toContain("Number(right.status === 'active') - Number(left.status === 'active')");
  });

  it('requires a successful provider lookup and never grants an unbounded period', async () => {
    const code = await source();
    expect(code).toContain('if (!response.ok) continue;');
    expect(code).toContain('const status = paypalStatus(remoteStatus);');
    expect(code).toContain("status === 'active'");
    expect(code).toContain("if (status === 'active') {");
    expect(code).toContain("typeof periodEnd === 'string' && Date.parse(periodEnd) > nowMs");
    expect(code).not.toContain('update.current_period_end = null;');
    expect(code).not.toContain('delete update.current_period_end;');
    expect(code.indexOf('if (!response.ok) continue;')).toBeLessThan(
      code.indexOf("if (status === 'active') {")
    );
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

  it('paginates scheduled pending PayPal records beyond the newest 500 and caps work per run', async () => {
    for (const path of [
      'base44/functions/reconcilePendingPayPal/entry.ts',
      'base44/functions/reconcilePendingPayPal/main.ts',
    ]) {
      const code = await readFile(path, 'utf8');
      expect(code, path).toContain('for (let skip = 0; ; skip += pageSize)');
      expect(code, path).toContain("'-created_date',");
      expect(code, path).toContain('allPending.push(...page)');
      expect(code, path).toContain('if (page.length < pageSize) break;');
      expect(code, path).toContain('const BATCH_SIZE = 100;');
      expect(code, path).toContain('const minuteBucket = Math.floor(Date.now() / 60_000)');
      expect(code, path).toContain('const mixedMinute = Math.imul(');
      expect(code, path).toContain('const start = allPending.length ? mixedMinute % allPending.length : 0;');
      expect(code, path).not.toContain('* 53) % allPending.length');
      expect(code, path).toContain('allPending.slice(start).concat(allPending.slice(0, start)).slice(0, BATCH_SIZE)');
      expect(code, path).not.toContain("'-created_date',\n      500,");
    }
  });

  it('reports missing provider IDs without counting them as checked', async () => {
    for (const path of [
      'base44/functions/reconcilePendingPayPal/entry.ts',
      'base44/functions/reconcilePendingPayPal/main.ts',
    ]) {
      const code = await readFile(path, 'utf8');
      expect(code, path).toContain("results.push({ result: 'missing_subscription_id' });");
      expect(code, path).toContain('discovered: allPending.length');
      expect(code, path).toContain('selected: pending.length');
      expect(code, path).toContain("checked: results.filter((x) => x.result !== 'missing_subscription_id').length");
      expect(code, path).toContain("missingProviderId: results.filter((x) => x.result === 'missing_subscription_id').length");
      expect(code, path).not.toContain('checked: pending.length');
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
    expect(code).toContain("const needsCurrentProviderStatus =");
    expect(code).toContain("remoteSubscription.status !== 'ACTIVE'");
    expect(code).toContain("remoteSubscription.planId !== record.paypal_plan_id");
    expect(code).toContain('providerMismatch || requiresRestorationBillingVerification ||');
    expect(code).toContain('requiresPayPalBillingVerification(record.status, newStatus, periodEnd)');
    expect(code.indexOf("remoteSubscription.status !== 'ACTIVE'")).toBeLessThan(
      code.indexOf('await entities.Subscription.update(record.id, update)')
    );
  });

  it('never uses the sale ID as a recurring subscription lookup key', async () => {
    const code = await readFile('base44/functions/paypalWebhook/entry.ts', 'utf8');
    const resolve = code.indexOf("const paymentEvent = event.event_type.startsWith('PAYMENT.');");
    const query = code.indexOf("const records = await entities.Subscription.filter(");
    expect(resolve).toBeGreaterThan(0);
    expect(query).toBeGreaterThan(resolve);
    expect(code).toContain("typeof event.resource?.billing_agreement_id === 'string'");
    expect(code).toContain("const subscriptionId = paymentEvent");
    expect(code).toContain("processing_state: 'failed'");
    expect(code).toContain("error: 'Subscription reference verification required'");
    expect(code).not.toContain("let subscriptionId = event.resource?.id || event.resource?.billing_agreement_id");
  });

  it('requires a future billing period only for active restoration, not cancellation or suspension', async () => {
    const code = await readFile('base44/functions/paypalWebhook/entry.ts', 'utf8');
    const restoration = code.indexOf("const requiresRestorationBillingVerification = newStatus === 'active' &&");
    const activePeriod = code.indexOf("record.status !== 'active' &&", restoration);
    const finalGuard = code.indexOf('if (providerMismatch || requiresRestorationBillingVerification ||');
    expect(restoration).toBeGreaterThan(0);
    expect(activePeriod).toBeGreaterThan(restoration);
    expect(finalGuard).toBeGreaterThan(activePeriod);
    expect(code).not.toContain('const requiresRestorationBillingVerification = needsCurrentProviderStatus &&');
  });

  it('verifies current PayPal status and owner before applying canceled or unpaid webhooks', async () => {
    const code = await readFile('base44/functions/paypalWebhook/entry.ts', 'utf8');
    const providerCheck = code.indexOf('const providerMismatch = needsCurrentProviderStatus');
    const update = code.indexOf('await entities.Subscription.update(record.id, update)');
    expect(providerCheck).toBeGreaterThan(0);
    expect(update).toBeGreaterThan(providerCheck);
    const guards = code.slice(providerCheck, update);
    expect(code).toContain("newStatus === 'canceled' || newStatus === 'unpaid'");
    expect(guards).toContain("remoteSubscription.customId !== record.user_id + ':' + record.sku");
    expect(guards).toContain("remoteSubscription.planId !== record.paypal_plan_id");
    expect(guards).toContain("remoteSubscription.status !== 'CANCELLED'");
    expect(guards).toContain("remoteSubscription.status !== 'EXPIRED'");
    expect(guards).toContain("remoteSubscription.status !== 'SUSPENDED'");
    expect(guards).toContain("processing_state: 'failed'");
    expect(guards).toContain('status: 503');
  });

  it('leaves refunds of still-active PayPal agreements reviewable, not processed', async () => {
    const code = await readFile('base44/functions/paypalWebhook/entry.ts', 'utf8');
    const adjustment = code.indexOf("if (current.status === 'ACTIVE') {");
    const canceled = code.indexOf("if (current.status === 'CANCELLED' || current.status === 'EXPIRED')");
    expect(adjustment).toBeGreaterThan(0);
    expect(canceled).toBeGreaterThan(adjustment);
    const activeAdjustment = code.slice(adjustment, canceled);
    expect(activeAdjustment).toContain("processing_state: 'failed'");
    expect(activeAdjustment).not.toContain("processing_state: 'processed'");
    expect(activeAdjustment).toContain('financial review');
    expect(activeAdjustment).toContain('reviewRequired: true');
    expect(activeAdjustment).toContain('status: 503');
    expect(activeAdjustment).not.toContain('Subscription.update(');
  });

  it('does not cancel a recurring agreement solely because a sale was refunded or reversed', async () => {
    const code = await readFile('base44/functions/paypalWebhook/entry.ts', 'utf8');
    expect(code).toContain("if (type === 'PAYMENT.SALE.REFUNDED' || type === 'PAYMENT.SALE.REVERSED') return null;");
    expect(code).toContain('const isPaymentAdjustment =');
    expect(code).toContain('const current = await fetchSubscriptionBillingInfo(token, subscriptionId)');
    expect(code).toContain("current.customId !== record.user_id + ':' + record.sku");
    expect(code).toContain("if (current.status === 'ACTIVE') {");
    expect(code).toContain('reviewRequired: true');
    expect(code).toContain('const newStatus = state(event.event_type, event.resource);');
    expect(code).not.toContain("adjustmentStatus = 'canceled'");
    expect(code).not.toContain("adjustmentStatus = 'unpaid'");
    const verifiedAdjustment = code.slice(
      code.indexOf('if (isPaymentAdjustment) {'),
      code.indexOf('const newStatus = state(event.event_type, event.resource);'),
    );
    expect(verifiedAdjustment).toContain("processing_state: 'failed'");
    expect(verifiedAdjustment).toContain('lifecycle status is unchanged');
    expect(verifiedAdjustment).toContain('reviewRequired: true');
    expect(verifiedAdjustment).toContain('status: 503');
    expect(verifiedAdjustment).not.toContain('Subscription.update(');
    expect(code).not.toContain("type === 'PAYMENT.SALE.REVERSED') return 'canceled'");
  });

  it('does not use refunded or reversed sale events as subscription lifecycle transitions', async () => {
    const code = await readFile('base44/functions/paypalWebhook/entry.ts', 'utf8');
    const adjustment = code.indexOf('if (isPaymentAdjustment) {');
    const lifecycle = code.indexOf('const newStatus = state(event.event_type, event.resource);');
    const subscriptionUpdate = code.indexOf('await entities.Subscription.update(record.id, update)');
    expect(adjustment).toBeGreaterThan(0);
    expect(lifecycle).toBeGreaterThan(adjustment);
    expect(subscriptionUpdate).toBeGreaterThan(lifecycle);
    const adjustmentBranch = code.slice(adjustment, lifecycle);
    expect(adjustmentBranch).toContain('return Response.json({');
    expect(adjustmentBranch).toContain('reviewRequired: true');
    expect(adjustmentBranch).not.toContain('paypal_event_time: incomingEventTime');
    expect(adjustmentBranch).not.toContain('Subscription.update(');
    expect(code).toContain("if (type === 'PAYMENT.SALE.REFUNDED' || type === 'PAYMENT.SALE.REVERSED') return null;");
  });

  it('requires current PayPal ACTIVE, owner and plan before any webhook reactivation', async () => {
    const code = await readFile('base44/functions/paypalWebhook/entry.ts', 'utf8');
    const guard = code.indexOf("const needsCurrentProviderStatus =");
    const update = code.indexOf('await entities.Subscription.update(record.id, update)');
    expect(guard).toBeGreaterThan(0);
    expect(update).toBeGreaterThan(guard);
    const beforeUpdate = code.slice(guard, update);
    expect(beforeUpdate).toContain("remoteSubscription.status !== 'ACTIVE'");
    expect(beforeUpdate).toContain('remoteSubscription.planId !== record.paypal_plan_id');
    expect(beforeUpdate).toContain("remoteSubscription.customId !== record.user_id + ':' + record.sku");
    expect(beforeUpdate).toContain('requiresRestorationBillingVerification');
    expect(beforeUpdate).toContain("record.status !== 'active'");
    expect(beforeUpdate).toContain("status: 503");
  });

  it('uses fresh provider billing date instead of event date for pending activation', async () => {
    const code = await readFile('base44/functions/paypalWebhook/entry.ts', 'utf8');
    expect(code).toContain('const billingTime = remoteSubscription?.nextBillingTime');
    expect(code).toContain('const providerMismatch = needsCurrentProviderStatus');
    expect(code.indexOf('const billingTime = remoteSubscription?.nextBillingTime')).toBeLessThan(
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

  it('validates newly created PayPal approval URLs before persisting checkout', async () => {
    const code = await readFile('base44/functions/createPayPalSubscription/entry.ts', 'utf8');
    const approvalValidation = code.indexOf('const expectedApprovalHost =');
    const createRecord = code.indexOf('await base44.asServiceRole.entities.Subscription.create({');
    expect(approvalValidation).toBeGreaterThan(0);
    expect(createRecord).toBeGreaterThan(approvalValidation);
    const guards = code.slice(approvalValidation, createRecord);
    expect(guards).toContain("newApprovalUrl.protocol !== 'https:'");
    expect(guards).toContain('newApprovalUrl.hostname !== expectedApprovalHost');
    expect(guards).toContain('PayPal returned an invalid approval URL');
    expect(guards).toContain('status: 502');
  });

  it('blocks PayPal creation while Stripe or Wix recurring checkout is unresolved', async () => {
    const code = await readFile('base44/functions/createPayPalSubscription/entry.ts', 'utf8');
    const guard = code.indexOf('const unresolvedOtherProvider = allSubs.some');
    const create = code.indexOf("const res = await fetch(apiBase() + '/v1/billing/subscriptions'");
    expect(guard).toBeGreaterThan(0);
    expect(create).toBeGreaterThan(guard);
    const beforeCreate = code.slice(guard, create);
    expect(beforeCreate).toContain("sub.provider === 'stripe' || sub.provider === 'wix'");
    expect(beforeCreate).toContain("normalizeStatus(sub.status) === 'pending'");
    expect(beforeCreate).toContain("normalizeStatus(sub.status) === 'incomplete'");
    expect(beforeCreate).toContain('An existing Stripe or Wix checkout requires verification before PayPal checkout');
    expect(beforeCreate).toContain('status: 409');
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

  it('bounds PayPal request IDs and prevents persisted request-key plan reuse', async () => {
    const code = await readFile('base44/functions/createPayPalSubscription/entry.ts', 'utf8');
    expect(code).toContain("const providerRequestId = 'nalichat-' + user.id + '-' + idempotencyKey;");
    expect(code).toContain('if (providerRequestId.length > 108)');
    expect(code).toContain("'PayPal-Request-Id': providerRequestId");
    expect(code).toContain('sub.checkout_request_key === idempotencyKey');
    expect(code).toContain('sub.sku !== sku');
    expect(code).toContain('checkout_request_key: idempotencyKey,');
    expect(code.indexOf('if (providerRequestId.length > 108)')).toBeLessThan(
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
