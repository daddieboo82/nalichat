import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { secrets } from 'base44:runtime';
import { paypalPeriodEndForStatus, resolvePayPalSubscriptionStatus } from '../../shared/paypalSubscription.ts';

const WORKFLOW_KEY = 'nali-paypal-reconcile-v1-20260925';

function apiBase() {
  return (secrets.get('PAYPAL_ENVIRONMENT') || 'live').toLowerCase() === 'sandbox'
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';
}

async function accessToken() {
  const id = secrets.get('PAYPAL_CLIENT_ID');
  const secret = secrets.get('PAYPAL_CLIENT_SECRET');
  if (!id || !secret) throw new Error('PayPal credentials are not configured');
  const response = await fetch(apiBase() + '/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(id + ':' + secret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error('PayPal authentication failed');
  return String(data.access_token);
}

function localStatus(remoteStatus: unknown) {
  const status = String(remoteStatus || '').toUpperCase();
  if (status === 'ACTIVE') return 'active';
  if (status === 'CANCELLED' || status === 'EXPIRED') return 'canceled';
  if (status === 'SUSPENDED') return 'unpaid';
  return null;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const user = await base44.auth.me().catch(() => null);
    const workflowAuthorized = body?.workflow_key === WORKFLOW_KEY;
    if (!workflowAuthorized && user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const token = await accessToken();
    // Scan every pending page, then process a bounded rotating window.
    // Always fetching only the newest 500 can permanently exclude old rows
    // while the same unverifiable checkouts remain pending.
    const allPending: any[] = [];
    const pageSize = 200;
    for (let skip = 0; ; skip += pageSize) {
      const page = await base44.asServiceRole.entities.Subscription.filter(
        { provider: 'paypal', status: 'pending' },
        '-created_date',
        pageSize,
        skip,
      );
      allPending.push(...page);
      if (page.length < pageSize) break;
    }
    const BATCH_SIZE = 100;
    // Mix the time bucket before selecting a starting row. A fixed step
    // can alias a workflow's regular cadence and repeatedly revisit only a
    // fraction of a large backlog. This is best-effort, not a durable cursor.
    const minuteBucket = Math.floor(Date.now() / 60_000);
    const mixedMinute = Math.imul(
      minuteBucket ^ (minuteBucket >>> 16), 0x45d9f3b,
    ) >>> 0;
    const start = allPending.length ? mixedMinute % allPending.length : 0;
    const pending = allPending.length
      ? allPending.slice(start).concat(allPending.slice(0, start)).slice(0, BATCH_SIZE)
      : [];

    const results = [];
    for (const subscription of pending) {
      const subscriptionId = String(subscription.subscription_id || '');
      if (!subscriptionId) continue;
      try {
        const response = await fetch(
        apiBase() + '/v1/billing/subscriptions/' + encodeURIComponent(subscriptionId),
        { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } },
      );
      if (!response.ok) {
        results.push({ subscriptionId, result: 'paypal_lookup_failed', httpStatus: response.status });
        continue;
      }
      const remote = await response.json();
      // resolvePayPalSubscriptionStatus can POST /activate for APPROVED.
      // Check the pending record's plan and owner before that side effect.
      if (typeof subscription.paypal_plan_id !== 'string' ||
          remote?.plan_id !== subscription.paypal_plan_id ||
          typeof subscription.user_id !== 'string' ||
          typeof subscription.sku !== 'string' ||
          remote?.custom_id !== subscription.user_id + ':' + subscription.sku) {
        results.push({ subscriptionId, result: 'ownership_or_plan_unverified' });
        continue;
      }
      const remoteStatus = await resolvePayPalSubscriptionStatus(apiBase(), token, subscriptionId, remote);
      const status = localStatus(remoteStatus);
      if (!status) {
        results.push({ subscriptionId, result: 'unchanged', paypalStatus: remoteStatus || remote?.status || null });
        continue;
      }

      const periodEnd = paypalPeriodEndForStatus(status, remote?.billing_info?.next_billing_time);
      // Do not promote a pending checkout to unbounded paid access when
      // PayPal reports ACTIVE without a verified future billing boundary.
      // hasPaidTierAccess treats active + null period as unrestricted access.
      if (status === 'active' && (typeof periodEnd !== 'string' || Date.parse(periodEnd) <= Date.now())) {
        results.push({ subscriptionId, result: 'needs_billing_period_verification', paypalStatus: remoteStatus });
        continue;
      }
      const update: Record<string, unknown> = { status };
      if (periodEnd !== undefined) update.current_period_end = periodEnd;
      if (status === 'canceled') update.cancel_at_period_end = false;
      await base44.asServiceRole.entities.Subscription.update(subscription.id, update);
      results.push({ subscriptionId, result: 'updated', status, paypalStatus: remote?.status || null });
      } catch (error) {
        // One transient provider/entity failure must not starve every other
        // pending subscription in this scheduled reconciliation batch.
        console.error('PayPal per-subscription reconciliation failed', error);
        results.push({ subscriptionId, result: 'record_failed' });
      }
    }

    return Response.json({
      success: true,
      action: 'reconcile_pending_paypal',
      checked: pending.length,
      updated: results.filter((x) => x.result === 'updated').length,
      results,
    });
  } catch (error) {
    console.error('reconcilePendingPayPal error', error);
    return Response.json({ error: 'PayPal reconciliation failed' }, { status: 500 });
  }
});
