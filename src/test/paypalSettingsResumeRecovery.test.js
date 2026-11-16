import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('PayPal pending approval recovery in Settings', () => {
  it('offers recovery only for pending accounts without paid access', async () => {
    const source = await readFile('src/components/settings/SubscriptionSettings.jsx', 'utf8');
    expect(source).toContain('subscription.hasPending && !subscription.hasPaidAccess');
    expect(source).toContain('Continue existing PayPal approval');
    expect(source).toContain('resumePendingPayPalApproval({ expectedUserId: user.id })');
    expect(source).toContain('resumingApproval || !user?.id || subscription.hasPaidAccess || !subscription.hasPending');
    expect(source).toContain('mailto:nalichat@nalichat.org?subject=NaliChat%20PayPal%20billing%20review');
  });
  it('offers a verified status refresh only when all reviewed PayPal agreements are terminal', async () => {
    const source = await readFile('src/components/settings/SubscriptionSettings.jsx', 'utf8');
    expect(source).toContain('pendingReview.results.length > 0');
    expect(source).toContain('pendingReview.results.every((result) => ["cancelled", "expired"].includes(result.status))');
    expect(source).toContain('onClick={refreshPendingStatus}');
    expect(source).toContain('base44.functions.invoke("reconcileTerminalPayPal", {})');
    expect(source).toContain('result.action !== "reconcile_terminal_paypal"');
    expect(source).toContain('const refresh = await refetch()');
    expect(source).toContain('refresh.isError || refresh.error || !refresh.data');
    expect(source).toContain('Earlier billing still needs review. Please contact support before another checkout.');
    expect(source).toContain('Refresh subscription status');
    expect(source).toContain('if (refreshingPending || !user?.id || !subscription.hasPending) return');
    expect(source).not.toContain('createPayPalSubscription');
  });

  it('never activates PayPal while reconciling terminal legacy agreements', async () => {
    const backend = await readFile('base44/functions/reconcileTerminalPayPal/entry.ts', 'utf8');
    expect(backend).toContain("user_id: user.id, provider: 'paypal', status: 'pending'");
    expect(backend).toContain("['CANCELLED', 'EXPIRED'].includes");
    expect(backend).toContain("remote?.custom_id !== user.id + ':' + row.sku");
    expect(backend).toContain("const latest = await subscriptions.filter(");
    expect(backend).toContain("latest.length !== pending.length");
    expect(backend).toContain("latest.some((row: any) => !originalIds.has(row.id))");
    expect(backend).toContain("const current = await subscriptions.get(row.id)");
    expect(backend).toContain("current.paypal_plan_id !== row.paypal_plan_id");
    expect(backend).toContain("current.paypal_environment !== env");
    expect(backend).toContain("applyVerifiedTerminalPayPalRows(");
    const helper = await readFile('base44/shared/terminalPayPalRecovery.ts', 'utf8');
    expect(helper).toContain("await subscriptions.updateMany(");
    expect(helper).toContain("status: 'pending',");
    expect(helper).toContain("$set: { status: 'canceled', cancel_at_period_end: false }");
    expect(helper).toContain("Number(outcome?.updated || 0) !== 1");
    expect(backend.indexOf("const latest = await subscriptions.filter(")).toBeLessThan(
      backend.indexOf("applyVerifiedTerminalPayPalRows(")
    );
    expect(backend).not.toContain("await subscriptions.update(row.id");
    expect(backend).not.toContain("'/activate'");
    expect(backend).not.toContain("'/cancel'");
    expect(backend).not.toContain("subscriptions.create(");
  });

});
