import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { secrets } from 'base44:runtime';

function apiBase() {
  return (secrets.get('PAYPAL_ENVIRONMENT') || 'live').toLowerCase() === 'sandbox'
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';
}

async function accessToken() {
  const id = secrets.get('PAYPAL_CLIENT_ID');
  const secret = secrets.get('PAYPAL_CLIENT_SECRET');
  if (!id || !secret) throw new Error('PayPal credentials are not configured');
  const res = await fetch(apiBase() + '/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(id + ':' + secret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error('PayPal authentication failed');
  return data.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Authentication required' }, { status: 401 });

    const rows = await base44.asServiceRole.entities.Subscription.filter({ user_id: user.id, provider: 'paypal' });
    const active = (rows || []).find((row: any) =>
      row?.subscription_id && ['active', 'trialing', 'canceled'].includes(String(row.status || '').toLowerCase())
    );
    if (!active?.subscription_id) {
      return Response.json({ error: 'No active PayPal subscription found' }, { status: 404 });
    }
    if (String(active.status).toLowerCase() === 'canceled') {
      return Response.json({ success: true, action: 'cancel_paypal_subscription', userId: user.id, alreadyCanceled: true });
    }

    const token = await accessToken();
    const res = await fetch(apiBase() + '/v1/billing/subscriptions/' + encodeURIComponent(active.subscription_id) + '/cancel', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Customer requested cancellation in NaliChat Settings' }),
    });
    if (!res.ok && res.status !== 204) {
      const details = await res.text();
      console.error('PayPal cancellation failed', res.status, details);
      return Response.json({ error: 'Unable to cancel PayPal subscription' }, { status: 502 });
    }

    // PayPal's webhook remains authoritative for entitlement state. Do not revoke access here.
    return Response.json({
      success: true,
      action: 'cancel_paypal_subscription',
      userId: user.id,
      subscriptionId: active.subscription_id,
      awaitingWebhook: true,
    });
  } catch (error) {
    console.error('PayPal cancellation error', error);
    return Response.json({ error: 'Unable to cancel PayPal subscription' }, { status: 500 });
  }
});