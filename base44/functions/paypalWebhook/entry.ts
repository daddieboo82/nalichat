import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { secrets } from 'base44:runtime';
import { paypalWebhookLedgerAction, shouldApplyPayPalEvent } from '../../shared/paypalWebhookLedger.ts';

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

// For PAYMENT.SALE.* events the billing_info lives on the subscription resource,
// not the sale resource. Fetch the subscription to get next_billing_time.
async function fetchSubscriptionBillingInfo(token: string, subscriptionId: string): Promise<{ nextBillingTime: string | null } | null> {
  try {
    const response = await fetch(apiBase() + '/v1/billing/subscriptions/' + encodeURIComponent(subscriptionId), {
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const remote = await response.json();
    const nextBilling = remote?.billing_info?.next_billing_time;
    return { nextBillingTime: typeof nextBilling === 'string' ? nextBilling : null };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  let ledger: any = null;
  let event: any;
  try {
    event = await req.json();
    if (!event?.id || !event?.event_type) return Response.json({ error: 'Invalid PayPal event' }, { status: 400 });
    if (!HANDLED.has(event.event_type)) return Response.json({ received: true, ignored: true });
    const token = await accessToken();
    if (!(await verify(req, event, token))) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const base44 = createClientFromRequest(req);
    const entities = base44.asServiceRole.entities;

    // ── Idempotency ledger: dedup redelivered events ──
    const existing = await entities.PayPalWebhookEvent.filter(
      { paypal_event_id: event.id }, '-created_date', 2,
    );
    if (existing.length > 1) {
      console.error('PayPal webhook ledger collision', event.id, existing.length);
      return Response.json({ error: 'Ledger reconciliation required' }, { status: 409 });
    }
    const ledgerAction = paypalWebhookLedgerAction(
      existing[0]?.processing_state,
      existing[0]?.updated_date || existing[0]?.created_date,
    );
    if (ledgerAction === 'duplicate') {
      return Response.json({ received: true, duplicate: true });
    }
    if (ledgerAction === 'busy') {
      return Response.json({ error: 'Event is already processing; retry later' }, { status: 409 });
    }
    if (existing[0]) {
      ledger = existing[0];
      await entities.PayPalWebhookEvent.update(ledger.id, {
        processing_state: 'processing',
        attempt_count: (ledger.attempt_count || 1) + 1,
        last_error: '',
      });
    } else {
      try {
        ledger = await entities.PayPalWebhookEvent.create({
          paypal_event_id: event.id,
          event_type: event.event_type,
          event_time: event.create_time || new Date().toISOString(),
          processing_state: 'processing',
          attempt_count: 1,
        });
      } catch (createError: any) {
        const raced = await entities.PayPalWebhookEvent.filter(
          { paypal_event_id: event.id }, '-created_date', 2,
        );
        if (!raced[0]) throw createError;
        const racedAction = paypalWebhookLedgerAction(
          raced[0].processing_state,
          raced[0].updated_date || raced[0].created_date,
        );
        if (racedAction === 'duplicate') {
          return Response.json({ received: true, duplicate: true });
        }
        if (racedAction === 'busy') {
          return Response.json({ error: 'Event is already processing; retry later' }, { status: 409 });
        }
        throw createError;
      }
    }

    // ── Resolve subscription record ──
    let subscriptionId = event.resource?.id || event.resource?.billing_agreement_id || '';
    if (event.event_type.startsWith('PAYMENT.') && event.resource?.billing_agreement_id) {
      subscriptionId = event.resource.billing_agreement_id;
    }
    if (!subscriptionId) {
      await entities.PayPalWebhookEvent.update(ledger.id, {
        processing_state: 'ignored',
        processed_at: new Date().toISOString(),
        last_error: '',
      });
      return Response.json({ received: true, ignored: true });
    }

    const records = await entities.Subscription.filter({ provider: 'paypal', subscription_id: subscriptionId }, '-created_date', 2);
    if (records.length === 0) {
      // Race: webhook arrived before Subscription.create completed. Return 200
      // so PayPal does not redeliver aggressively; the reconcilePendingPayPal
      // fallback in checkSubscriptionStatus will catch up once the record exists.
      console.warn('PayPal webhook: no subscription record yet for', subscriptionId);
      await entities.PayPalWebhookEvent.update(ledger.id, {
        processing_state: 'ignored',
        processed_at: new Date().toISOString(),
        last_error: 'No subscription record found; reconcile will catch up',
      });
      return Response.json({ received: true, ignored: true });
    }
    if (records.length > 1) {
      console.error('PayPal webhook: multiple subscription records for', subscriptionId, records.length);
      await entities.PayPalWebhookEvent.update(ledger.id, {
        processing_state: 'failed',
        processed_at: new Date().toISOString(),
        last_error: `Multiple subscription records (${records.length}) require operator reconciliation`,
      });
      return Response.json({ error: 'Subscription reconciliation required' }, { status: 409 });
    }
    const record = records[0];

    // ── Stale-event protection ──
    const incomingEventTime = event.create_time || new Date().toISOString();
    if (
      !shouldApplyPayPalEvent(
        record.paypal_event_id,
        record.paypal_event_time,
        event.id,
        incomingEventTime,
      )
    ) {
      await entities.PayPalWebhookEvent.update(ledger.id, {
        processing_state: 'ignored',
        processed_at: new Date().toISOString(),
        last_error: 'Stale event skipped',
      });
      return Response.json({ received: true, duplicate: true });
    }

    // ── Apply status update ──
    const newStatus = state(event.event_type, event.resource);
    if (newStatus) {
      const update: Record<string, unknown> = {
        status: newStatus,
        paypal_event_id: event.id,
        paypal_event_time: incomingEventTime,
      };
      if (newStatus === 'canceled') update.cancel_at_period_end = false;

      // For PAYMENT.SALE.* events, billing_info is on the subscription resource,
      // not the sale resource — fetch it to get next_billing_time.
      if (event.event_type.startsWith('PAYMENT.')) {
        const billingInfo = await fetchSubscriptionBillingInfo(token, subscriptionId);
        if (billingInfo?.nextBillingTime) {
          update.current_period_end = billingInfo.nextBillingTime;
        }
      } else {
        const end = event.resource?.billing_info?.next_billing_time || event.resource?.billing_info?.final_payment_time;
        if (typeof end === 'string') update.current_period_end = end;
      }

      await entities.Subscription.update(record.id, update);
    }

    await entities.PayPalWebhookEvent.update(ledger.id, {
      processing_state: 'processed',
      processed_at: new Date().toISOString(),
      last_error: '',
    });
    return Response.json({ received: true, processed: true });
  } catch (error) {
    console.error('PayPal webhook error:', error);
    if (ledger?.id) {
      try {
        const base44 = createClientFromRequest(req);
        await base44.asServiceRole.entities.PayPalWebhookEvent.update(ledger.id, {
          processing_state: 'failed',
          processed_at: new Date().toISOString(),
          last_error: String(error?.message || error || '').slice(0, 2000),
        });
      } catch (ledgerError) {
        console.error('Failed to record PayPal webhook failure:', ledgerError);
      }
    }
    return Response.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
});