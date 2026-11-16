import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { secrets } from 'base44:runtime';
import { paypalPeriodEndForStatus } from '../../shared/paypalSubscription.ts';
import { paypalWebhookLedgerAction, shouldApplyPayPalEvent } from '../../shared/paypalWebhookLedger.ts';

const HANDLED = new Set([
  // CREATED is recorded for delivery diagnostics, never treated as payment.
  'CHECKOUT.ORDER.APPROVED',
  'BILLING.SUBSCRIPTION.CREATED',
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
  // A refunded or reversed sale does not necessarily cancel the agreement.
  // Its current status must be read from PayPal.
  if (type === 'PAYMENT.SALE.REFUNDED' || type === 'PAYMENT.SALE.REVERSED') return null;
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

// The subscription plan IDs this merchant configured, so an agreement's
// plan_id can be resolved back to the plan the buyer actually paid for.
const AGREEMENT_PLANS = [
  { secret: 'PAYPAL_PREMIUM_MONTHLY_PLAN_ID', plan: 'premium', billingPeriod: 'monthly', sku: 'premium_monthly' },
  { secret: 'PAYPAL_PREMIUM_YEARLY_PLAN_ID', plan: 'premium', billingPeriod: 'annual', sku: 'premium_yearly' },
  { secret: 'PAYPAL_PREMIUM_PLUS_MONTHLY_PLAN_ID', plan: 'premium_plus', billingPeriod: 'monthly', sku: 'premium_plus_monthly' },
  { secret: 'PAYPAL_PREMIUM_PLUS_YEARLY_PLAN_ID', plan: 'premium_plus', billingPeriod: 'annual', sku: 'premium_plus_yearly' },
];

function agreementPlan(planId: unknown) {
  if (typeof planId !== 'string' || !planId) return null;
  return AGREEMENT_PLANS.find((entry) => (secrets.get(entry.secret) || '') === planId) || null;
}

function statusFromAgreement(status: unknown): string {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'ACTIVE') return 'active';
  if (normalized === 'CANCELLED' || normalized === 'EXPIRED') return 'canceled';
  if (normalized === 'SUSPENDED') return 'unpaid';
  return 'pending';
}

// Rebuild the buyer's record from the provider's own agreement when the
// checkout write never landed. Only the signature-verified agreement is
// trusted: its id, a plan this merchant configured, and the custom_id our
// checkout wrote (user id + SKU). Nothing is taken from the event body.
async function claimAgreementForBuyer(entities: any, remote: any, subscriptionId: string) {
  const plan = agreementPlan(remote?.plan_id);
  if (!plan || remote?.id !== subscriptionId) return null;
  const customId = typeof remote?.custom_id === 'string' ? remote.custom_id : '';
  const separator = customId.lastIndexOf(':');
  if (separator <= 0) return null;
  const userId = customId.slice(0, separator);
  const sku = customId.slice(separator + 1);
  // The agreement must belong to the plan the buyer was charged for.
  if (!userId || sku !== plan.sku) return null;

  const environment = (secrets.get('PAYPAL_ENVIRONMENT') || 'live').toLowerCase();
  const status = statusFromAgreement(remote?.status);
  const periodEnd = paypalPeriodEndForStatus(status, remote?.billing_info?.next_billing_time);

  const created = await entities.Subscription.create({
    user_id: userId,
    plan: plan.plan,
    status,
    provider: 'paypal',
    billing_period: plan.billingPeriod,
    sku: plan.sku,
    subscription_id: subscriptionId,
    paypal_plan_id: remote.plan_id,
    paypal_environment: environment === 'sandbox' ? 'sandbox' : 'live',
    ...(periodEnd === undefined || periodEnd === null ? {} : { current_period_end: periodEnd }),
  });

  // Two events can be delivered together for one agreement. Keep a single row
  // so later deliveries are not blocked by a duplicate we just created.
  const rows = await entities.Subscription.filter(
    { provider: 'paypal', subscription_id: subscriptionId }, '-created_date', 5,
  );
  if (Array.isArray(rows) && rows.length > 1) {
    const ordered = [...rows].sort((a: any, b: any) =>
      String(a.created_date || '').localeCompare(String(b.created_date || '')));
    const keep = ordered[0];
    for (const row of ordered.slice(1)) {
      if (row.id !== keep.id && row.id === created?.id) {
        try {
          await entities.Subscription.delete(row.id);
        } catch (error) {
          console.error('Could not remove duplicate claimed subscription row', error);
        }
      }
    }
  }
  return created;
}

// Process only a PayPal-signed order-approval event belonging to a locally
// persisted one-time donation. No subscription is created or changed.
async function settleApprovedDonation(entities: any, accessToken: string, orderId: string) {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(orderId)) throw new Error('Invalid PayPal donation order identifier');
  const rows = await entities.PayPalDonation.filter({ order_id: orderId }, '-created_date', 2);
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error('Donation record not ready for PayPal retry');
  const record = rows[0];
  const env = (secrets.get('PAYPAL_ENVIRONMENT') || 'live').toLowerCase() === 'sandbox' ? 'sandbox' : 'live';
  if (record.environment !== env || ![5, 10, 25, 50].includes(Number(record.amount_usd))) {
    throw new Error('Donation environment or price mismatch');
  }
  const amount = Number(record.amount_usd).toFixed(2);
  const url = apiBase() + '/v2/checkout/orders/' + encodeURIComponent(orderId);
  const headers = { Authorization: 'Bearer ' + accessToken, Accept: 'application/json' };
  const response = await fetch(url, { headers });
  const order = await response.json().catch(() => null);
  if (!response.ok || order?.id !== orderId) throw new Error('PayPal donation lookup unavailable');
  if (!Array.isArray(order.purchase_units) || order.purchase_units.length !== 1 ||
      order.purchase_units[0]?.amount?.currency_code !== 'USD' ||
      order.purchase_units[0]?.amount?.value !== amount) throw new Error('Donation amount mismatch');

  if (order.status === 'APPROVED') {
    // Same idempotency key as the donor return flow: competing webhook and
    // browser requests cannot intentionally create separate captures.
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('capture:' + orderId));
    const captureKey = Array.from(new Uint8Array(bytes)).map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 36);
    const captureResponse = await fetch(url + '/capture', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', 'PayPal-Request-Id': captureKey },
      body: '{}',
    });
    if (!captureResponse.ok && captureResponse.status !== 422) throw new Error('PayPal donation capture not confirmed');
  } else if (order.status !== 'COMPLETED') {
    throw new Error('PayPal donation not approved or completed');
  }
  // Capture API responses, webhook payloads, and local paid flags are not proof.
  // Re-fetch the authenticated order and verify the completed provider capture.
  const finalResponse = await fetch(url, { headers });
  const completed = await finalResponse.json().catch(() => null);
  const units = completed?.purchase_units;
  const captures = units?.[0]?.payments?.captures;
  const capture = Array.isArray(captures) && captures.length === 1 ? captures[0] : null;
  if (!finalResponse.ok || completed?.id !== orderId || completed?.status !== 'COMPLETED' ||
      !Array.isArray(units) || units.length !== 1 ||
      units[0]?.amount?.currency_code !== 'USD' || units[0]?.amount?.value !== amount ||
      capture?.status !== 'COMPLETED' || capture?.amount?.currency_code !== 'USD' ||
      capture?.amount?.value !== amount || typeof capture?.id !== 'string') {
    throw new Error('PayPal donation paid capture not yet verified');
  }
  if (record.status !== 'paid') {
    await entities.PayPalDonation.update(record.id, {
      status: 'paid',
      paid_at: new Date().toISOString(),
      capture_id: capture.id,
      payer_id: typeof completed.payer?.payer_id === 'string' ? completed.payer.payer_id : '',
    });
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  // Receipt diagnostics are intentionally metadata-free. A receipt is NOT
  // proof of a valid PayPal event, signature, payment, or subscription.
  console.info('PayPal webhook POST received');
  let ledger: any = null;
  let event: any;
  try {
    try {
      event = await req.json();
    } catch {
      console.warn('PayPal webhook invalid JSON rejected');
      return Response.json({ error: 'Invalid PayPal event' }, { status: 400 });
    }
    if (!event?.id || !event?.event_type) {
      console.warn('PayPal webhook missing event envelope rejected');
      return Response.json({ error: 'Invalid PayPal event' }, { status: 400 });
    }
    // Authenticate every incoming event before acknowledging it, including
    // event types this handler does not currently process.
    const token = await accessToken();
    const verified = await verify(req, event, token);
    if (!verified) {
      // Authentication failures happen before the durable ledger. Log only
      // the rejection category: never log payloads, signatures, IDs, or tokens.
      console.warn('PayPal webhook signature verification rejected');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!HANDLED.has(event.event_type)) return Response.json({ received: true, ignored: true });

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

    if (event.event_type === 'CHECKOUT.ORDER.APPROVED') {
      // Only a signature-verified PayPal webhook may settle an approved
      // one-time donation. Ledger retries cover missing local records.
      await settleApprovedDonation(entities, token, String(event.resource?.id || ''));
      await entities.PayPalWebhookEvent.update(ledger.id, {
        processing_state: 'processed',
        processed_at: new Date().toISOString(),
        last_error: '',
      });
      return Response.json({ received: true, processed: true });
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

    let records = await entities.Subscription.filter({ provider: 'paypal', subscription_id: subscriptionId }, '-created_date', 5);
    if (records.length > 1) {
      console.error('PayPal webhook: multiple subscription records for', subscriptionId, records.length);
      await entities.PayPalWebhookEvent.update(ledger.id, {
        processing_state: 'failed',
        processed_at: new Date().toISOString(),
        last_error: `Multiple subscription records (${records.length}) require operator reconciliation`,
      });
      return Response.json({ error: 'Subscription reconciliation required' }, { status: 409 });
    }

    // A sale/refund event identifies a billing agreement, but does not itself
    // prove that the agreement belongs to this user or merchant. Verify the
    // provider-side subscription binding before changing paid access.
    const lookup = await fetch(apiBase() + '/v1/billing/subscriptions/' + encodeURIComponent(subscriptionId), {
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
    });
    if (!lookup.ok) {
      await entities.PayPalWebhookEvent.update(ledger.id, {
        processing_state: 'failed',
        processed_at: new Date().toISOString(),
        last_error: 'Unable to verify PayPal subscription identity',
      });
      return Response.json({ error: 'PayPal subscription verification unavailable' }, { status: 503 });
    }
    const verifiedRemote: any = await lookup.json();

    // The checkout write and this event race: a billed agreement can arrive
    // before its local row exists, or after that write failed. The verified
    // agreement is the authoritative record of who bought what, so claim it
    // rather than dropping a payment that already happened.
    if (records.length === 0) {
      console.warn('PayPal webhook: no local record; attempting to link agreement to its buyer', subscriptionId);
      await claimAgreementForBuyer(entities, verifiedRemote, subscriptionId);
      records = await entities.Subscription.filter({ provider: 'paypal', subscription_id: subscriptionId }, '-created_date', 5);
      if (records.length === 0) {
        // The row may be a moment away, or the agreement cannot be attributed.
        // Keep the provider retrying instead of dropping the payment.
        await entities.PayPalWebhookEvent.update(ledger.id, {
          processing_state: 'failed',
          processed_at: new Date().toISOString(),
          last_error: 'Agreement could not be linked to a buyer yet; PayPal should retry',
        });
        return Response.json({ error: 'Subscription record not ready' }, { status: 503 });
      }
      if (records.length > 1) {
        console.error('PayPal webhook: linking produced multiple records for', subscriptionId, records.length);
        await entities.PayPalWebhookEvent.update(ledger.id, {
          processing_state: 'failed',
          processed_at: new Date().toISOString(),
          last_error: `Multiple subscription records (${records.length}) require operator reconciliation`,
        });
        return Response.json({ error: 'Subscription reconciliation required' }, { status: 409 });
      }
      console.info('PayPal webhook: agreement linked to its buyer', subscriptionId);
    }

    const record = records[0];
    if (verifiedRemote?.id !== subscriptionId || (!verifiedRemote?.plan_id || ![record.paypal_plan_id, secrets.get('PAYPAL_PREMIUM_PLUS_MONTHLY_PLAN_ID'), secrets.get('PAYPAL_PREMIUM_PLUS_YEARLY_PLAN_ID')].includes(verifiedRemote.plan_id)) ||
        verifiedRemote?.custom_id !== record.user_id + ':' + (record.paypal_original_sku || record.sku)) {
      await entities.PayPalWebhookEvent.update(ledger.id, {
        processing_state: 'failed',
        processed_at: new Date().toISOString(),
        last_error: 'PayPal subscription identity mismatch',
      });
      return Response.json({ error: 'PayPal subscription identity mismatch' }, { status: 409 });
    }

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
    // Always derive entitlement from the current verified PayPal agreement.
    // An old activation/sale webhook must not reactivate a canceled agreement.
    const providerStatus = String(verifiedRemote?.status || '').toUpperCase();
    const newStatus = providerStatus === 'ACTIVE' ? 'active'
      : providerStatus === 'CANCELLED' || providerStatus === 'EXPIRED' ? 'canceled'
      : providerStatus === 'SUSPENDED' ? 'unpaid' : null;
    if (newStatus) {
      const update: Record<string, unknown> = {
        status: newStatus,
        paypal_event_id: event.id,
        paypal_event_time: incomingEventTime,
      };
      if (newStatus === 'canceled') update.cancel_at_period_end = false;
      // Apply an approved PayPal plan revision only after a signed webhook and
      // an authoritative provider lookup confirm the changed plan.
      if (verifiedRemote?.status === 'ACTIVE' && newStatus === 'active' &&
          verifiedRemote.plan_id !== record.paypal_plan_id) {
        const plusMonthly = secrets.get('PAYPAL_PREMIUM_PLUS_MONTHLY_PLAN_ID');
        const plusYearly = secrets.get('PAYPAL_PREMIUM_PLUS_YEARLY_PLAN_ID');
        if (verifiedRemote.plan_id === plusMonthly || verifiedRemote.plan_id === plusYearly) {
          update.plan = 'premium_plus';
          update.billing_period = verifiedRemote.plan_id === plusYearly ? 'annual' : 'monthly';
          update.paypal_plan_id = verifiedRemote.plan_id;
        }
      }

      // Always use the authenticated agreement's current billing schedule.
      // Webhook event resources can be sparse or delayed.
      const periodEnd = paypalPeriodEndForStatus(newStatus, verifiedRemote?.billing_info?.next_billing_time);
      if (periodEnd !== undefined) update.current_period_end = periodEnd;

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