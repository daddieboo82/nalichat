import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { secrets } from 'base44:runtime';

const HANDLED = new Set([
  'BILLING.SUBSCRIPTION.ACTIVATED',
  'BILLING.SUBSCRIPTION.UPDATED',
  'BILLING.SUBSCRIPTION.CANCELLED',
  'BILLING.SUBSCRIPTION.SUSPENDED',
  'BILLING.SUBSCRIPTION.EXPIRED',
  'PAYMENT.SALE.COMPLETED',
  'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
  'PAYMENT.SALE.REFUNDED',
  'PAYMENT.SALE.REVERSED',
]);

function apiBase() {
  return (secrets.get('PAYPAL_ENVIRONMENT') || 'live').toLowerCase() === 'sandbox'
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';
}
async function accessToken() {
  const id = secrets.get('PAYPAL_CLIENT_ID');
  const secret = secrets.get('PAYPAL_CLIENT_SECRET');
  if (!id || !secret) throw new Error('PayPal credentials are not configured');
  const r = await fetch(apiBase() + '/v1/oauth2/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(id + ':' + secret), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const d = await r.json();
  if (!r.ok || !d.access_token) throw new Error('PayPal authentication failed');
  return d.access_token as string;
}
async function verify(req: Request, event: any, token: string) {
  const webhookId = secrets.get('PAYPAL_WEBHOOK_ID');
  if (!webhookId) throw new Error('PAYPAL_WEBHOOK_ID is not configured');
  const r = await fetch(apiBase() + '/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_algo: req.headers.get('paypal-auth-algo'),
      cert_url: req.headers.get('paypal-cert-url'),
      transmission_id: req.headers.get('paypal-transmission-id'),
      transmission_sig: req.headers.get('paypal-transmission-sig'),
      transmission_time: req.headers.get('paypal-transmission-time'),
      webhook_id: webhookId,
      webhook_event: event,
    }),
  });
  const d = await r.json();
  return r.ok && d.verification_status === 'SUCCESS';
}
function state(type: string, resource: any) {
  if (type === 'BILLING.SUBSCRIPTION.ACTIVATED' || type === 'PAYMENT.SALE.COMPLETED') return 'active';
  if (type === 'BILLING.SUBSCRIPTION.CANCELLED' || type === 'BILLING.SUBSCRIPTION.EXPIRED') return 'canceled';
  if (type === 'BILLING.SUBSCRIPTION.SUSPENDED' || type === 'BILLING.SUBSCRIPTION.PAYMENT.FAILED') return 'unpaid';
  if (type === 'PAYMENT.SALE.REFUNDED' || type === 'PAYMENT.SALE.REVERSED') return 'canceled';
  const s = String(resource?.status || '').toUpperCase();
  if (s === 'ACTIVE') return 'active';
  if (s === 'CANCELLED' || s === 'EXPIRED') return 'canceled';
  if (s === 'SUSPENDED') return 'unpaid';
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const event = await req.json();
    if (!event?.id || !event?.event_type) return Response.json({ error: 'Invalid PayPal event' }, { status: 400 });
    if (!HANDLED.has(event.event_type)) return Response.json({ received: true, ignored: true });
    const token = await accessToken();
    if (!(await verify(req, event, token))) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const base44 = createClientFromRequest(req);
    const entities = base44.asServiceRole.entities;
    let subscriptionId = event.resource?.id || event.resource?.billing_agreement_id || '';
    if (event.event_type.startsWith('PAYMENT.') && event.resource?.billing_agreement_id) {
      subscriptionId = event.resource.billing_agreement_id;
    }
    if (!subscriptionId) return Response.json({ received: true, ignored: true });

    const records = await entities.Subscription.filter({ provider: 'paypal', subscription_id: subscriptionId }, '-created_date', 2);
    if (records.length !== 1) {
      console.error('PayPal subscription record lookup mismatch', subscriptionId, records.length);
      return Response.json({ error: 'Subscription reconciliation required' }, { status: 409 });
    }
    const status = state(event.event_type, event.resource);
    if (status) {
      const update: Record<string, unknown> = { status };
      const end = event.resource?.billing_info?.next_billing_time || event.resource?.billing_info?.final_payment_time;
      if (typeof end === 'string') update.current_period_end = end;
      if (status === 'canceled') update.cancel_at_period_end = false;
      await entities.Subscription.update(records[0].id, update);
    }
    return Response.json({ received: true, processed: true });
  } catch (error) {
    console.error('PayPal webhook error', error);
    return Response.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
});