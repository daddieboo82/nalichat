import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { secrets } from 'base44:runtime';

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
    const pending = await base44.asServiceRole.entities.Subscription.filter(
      { provider: 'paypal', status: 'pending' },
      '-created_date',
      500,
    );

    const results = [];
    for (const subscription of pending) {
      const subscriptionId = String(subscription.subscription_id || '');
      if (!subscriptionId) continue;
      const response = await fetch(
        apiBase() + '/v1/billing/subscriptions/' + encodeURIComponent(subscriptionId),
        { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } },
      );
      if (!response.ok) {
        results.push({ subscriptionId, result: 'paypal_lookup_failed', httpStatus: response.status });
        continue;
      }
      const remote = await response.json();
      const status = localStatus(remote?.status);
      if (!status) {
        results.push({ subscriptionId, result: 'unchanged', paypalStatus: remote?.status || null });
        continue;
      }

      const update: Record<string, unknown> = { status };
      const nextBilling = remote?.billing_info?.next_billing_time;
      if (typeof nextBilling === 'string') update.current_period_end = nextBilling;
      if (status === 'canceled') update.cancel_at_period_end = false;
      await base44.asServiceRole.entities.Subscription.update(subscription.id, update);
      results.push({ subscriptionId, result: 'updated', status, paypalStatus: remote?.status || null });
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
