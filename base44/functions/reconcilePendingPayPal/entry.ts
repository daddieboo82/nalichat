import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { secrets } from 'base44:runtime';
import { validWorkflowKey } from '../../shared/workflowAuth.ts';
import { paypalPeriodEndForStatus, resolvePayPalSubscriptionStatus } from '../../shared/paypalSubscription.ts';

const WORKFLOW_KEY_SHA256 = '323252dba547287b9145ee4298f77c69f5f454b1e1457a59822d31fadbb608f1';

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
    const workflowAuthorized = await validWorkflowKey(body?.workflow_key, WORKFLOW_KEY_SHA256);
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
      // Verify the exact customer and plan before activating an APPROVED
      // agreement or applying any status to a NaliChat entitlement.
      const expectedEnvironment = (secrets.get('PAYPAL_ENVIRONMENT') || 'live').toLowerCase();
      const expectedCustomer = subscription.user_id && subscription.sku
        ? subscription.user_id + ':' + subscription.sku : '';
      if (
        remote?.id !== subscriptionId ||
        !expectedCustomer ||
        remote?.custom_id !== expectedCustomer ||
        !subscription.paypal_plan_id ||
        remote?.plan_id !== subscription.paypal_plan_id ||
        subscription.paypal_environment !== expectedEnvironment
      ) {
        console.error('PayPal reconciliation binding mismatch', { subscriptionRecordId: subscription.id });
        results.push({ subscriptionId, result: 'identity_review_required' });
        continue;
      }
      const remoteStatus = await resolvePayPalSubscriptionStatus(apiBase(), token, subscriptionId, remote);
      const status = localStatus(remoteStatus);
      if (!status) {
        results.push({ subscriptionId, result: 'unchanged', paypalStatus: remoteStatus || remote?.status || null });
        continue;
      }

      const update: Record<string, unknown> = { status };
      const periodEnd = paypalPeriodEndForStatus(status, remote?.billing_info?.next_billing_time);
      if (periodEnd !== undefined) update.current_period_end = periodEnd;
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
