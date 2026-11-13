import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { secrets } from 'base44:runtime';
import { paypalPeriodEndForStatus, requiresPayPalBillingVerification } from '../../shared/paypalSubscription.ts';
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
  // A refund or reversal affects an individual sale, not necessarily the
  // entire recurring agreement. Resolve these events from the current
  // subscription state below instead of unconditionally canceling access.
  if (type === 'PAYMENT.SALE.REFUNDED' || type === 'PAYMENT.SALE.REVERSED') return null;
  const s = String(resource?.status || '').toUpperCase();
  if (s === 'ACTIVE') return 'active';
  if (s === 'CANCELLED' || s === 'EXPIRED') return 'canceled';
  if (s === 'SUSPENDED') return 'unpaid';
  return null;
}

// For PAYMENT.SALE.* events the billing_info lives on the subscription resource,
// not the sale resource. Fetch the subscription to get next_billing_time.
async function fetchSubscriptionBillingInfo(token: string, subscriptionId: string): Promise<{ nextBillingTime: string | null; status: string; planId: string | null; customId: string | null } | null> {
  try {
    const response = await fetch(apiBase() + '/v1/billing/subscriptions/' + encodeURIComponent(subscriptionId), {
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const remote = await response.json();
    const nextBilling = remote?.billing_info?.next_billing_time;
    return {
      nextBillingTime: typeof nextBilling === 'string' ? nextBilling : null,
      status: String(remote?.status || '').toUpperCase(),
      planId: typeof remote?.plan_id === 'string' ? remote.plan_id : null,
      customId: typeof remote?.custom_id === 'string' ? remote.custom_id : null,
    };
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

    // PayPal's event creation time is required for safe lifecycle ordering.
    // Never replace it with webhook receipt time: a delayed cancellation
    // could otherwise outrank a newer activation (or the reverse).
    const eventCreatedAt = typeof event.create_time === 'string'
      ? Date.parse(event.create_time)
      : Number.NaN;
    if (!Number.isFinite(eventCreatedAt) ||
        eventCreatedAt > Date.now() + 5 * 60_000) {
      return Response.json({ error: 'Invalid PayPal event creation time' }, { status: 400 });
    }

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
    // Prior releases acknowledged some still-active refunds as processed
    // even though their ledger note explicitly required financial review.
    // Reopen only that exact legacy case after validating the signed event;
    // never silently treat it as an already-settled accounting adjustment.
    const legacyUnreviewedAdjustment = (
      event.event_type === 'PAYMENT.SALE.REFUNDED' ||
      event.event_type === 'PAYMENT.SALE.REVERSED'
    ) && existing[0]?.processing_state === 'processed' &&
      existing[0]?.last_error ===
        'Refund/reversal recorded; active recurring agreement requires financial review';
    const ledgerAction = paypalWebhookLedgerAction(
      legacyUnreviewedAdjustment ? 'failed' : existing[0]?.processing_state,
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
          event_time: event.create_time,
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
    // PAYMENT.SALE.* resource.id is a *sale* ID, not a subscription ID.
    // Never use it to look up or mutate a Subscription record. A missing
    // billing_agreement_id needs operator/provider verification and retry.
    const paymentEvent = event.event_type.startsWith('PAYMENT.');
    const subscriptionId = paymentEvent
      ? (typeof event.resource?.billing_agreement_id === 'string' ? event.resource.billing_agreement_id : '')
      : (typeof event.resource?.id === 'string' ? event.resource.id : '');
    if (!subscriptionId) {
      await entities.PayPalWebhookEvent.update(ledger.id, {
        processing_state: 'failed',
        processed_at: new Date().toISOString(),
        last_error: 'Signed event has no usable subscription reference',
      });
      return Response.json({ error: 'Subscription reference verification required' }, { status: 503 });
    }

    const records = await entities.Subscription.filter({ provider: 'paypal', subscription_id: subscriptionId }, '-created_date', 2);
    if (records.length === 0) {
      // The local row can land a moment after PayPal emits the event. A 200
      // with ignored state would permanently drop the payment, so ask PayPal
      // to retry until the subscription record exists.
      console.warn('PayPal webhook: no subscription record yet for', subscriptionId);
      await entities.PayPalWebhookEvent.update(ledger.id, {
        processing_state: 'failed',
        processed_at: new Date().toISOString(),
        last_error: 'No subscription record found yet; PayPal should retry',
      });
      return Response.json({ error: 'Subscription record not ready' }, { status: 503 });
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

    // Financial adjustments belong to accounting, not to the ordered
    // subscription lifecycle. Keep signed refunds and reversals reviewable
    // even when their timestamps predate or equal the last lifecycle event,
    // or the legacy lifecycle watermark is missing.
    const isPaymentAdjustment = event.event_type === 'PAYMENT.SALE.REFUNDED' ||
      event.event_type === 'PAYMENT.SALE.REVERSED';

    // ── Stale-event protection ──
    const incomingEventTime = event.create_time;
    // Different provider lifecycle events with identical create_time cannot
    // be ordered. Do not acknowledge one as permanently ignored: surface a
    // retryable reconciliation failure without changing subscription state.
    const lastEventTimeMs = typeof record.paypal_event_time === 'string'
      ? Date.parse(record.paypal_event_time)
      : Number.NaN;
    // A stored event ID without a valid stored event time is a legacy
    // ordering gap. Do not let a new signed event blindly overwrite it.
    if (!isPaymentAdjustment && record.paypal_event_id &&
        record.paypal_event_id !== event.id &&
        !Number.isFinite(lastEventTimeMs)) {
      await entities.PayPalWebhookEvent.update(ledger.id, {
        processing_state: 'failed',
        processed_at: new Date().toISOString(),
        last_error: 'Recorded PayPal event timestamp requires reconciliation',
      });
      return Response.json({ error: 'PayPal event history requires reconciliation' }, { status: 503 });
    }
    if (!isPaymentAdjustment && record.paypal_event_id !== event.id &&
        Number.isFinite(lastEventTimeMs) &&
        lastEventTimeMs === eventCreatedAt) {
      await entities.PayPalWebhookEvent.update(ledger.id, {
        processing_state: 'failed',
        processed_at: new Date().toISOString(),
        last_error: 'Same-timestamp PayPal events require provider reconciliation',
      });
      return Response.json({ error: 'PayPal event order requires reconciliation' }, { status: 503 });
    }
    if (
      !isPaymentAdjustment && !shouldApplyPayPalEvent(
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
    // A refunded/reversed sale does not prove that the entire PayPal
    // agreement was canceled. Re-read the subscription and verify owner/plan.
    // If the agreement remains ACTIVE, preserve local lifecycle status and
    // surface the adjustment for financial review rather than revoking access.
    if (isPaymentAdjustment) {
      const current = await fetchSubscriptionBillingInfo(token, subscriptionId);
      if (!current || !current.planId ||
          current.planId !== record.paypal_plan_id ||
          typeof record.user_id !== 'string' ||
          typeof record.sku !== 'string' ||
          current.customId !== record.user_id + ':' + record.sku) {
        await entities.PayPalWebhookEvent.update(ledger.id, {
          processing_state: 'failed',
          processed_at: new Date().toISOString(),
          last_error: 'Refund/reversal subscription ownership or status could not be verified',
        });
        return Response.json({ error: 'PayPal subscription verification required' }, { status: 503 });
      }
      if (current.status === 'ACTIVE') {
        // The recurring agreement remains active, but the financial
        // adjustment is unresolved. Keep the ledger reviewable and retryable;
        // do not acknowledge accounting completion or revoke paid access.
        await entities.PayPalWebhookEvent.update(ledger.id, {
          processing_state: 'failed',
          processed_at: new Date().toISOString(),
          last_error: 'Refund/reversal of an active recurring agreement requires financial review',
        });
        return Response.json({ error: 'PayPal financial adjustment requires reconciliation', reviewRequired: true }, { status: 503 });
      }
      // A sale refund/reversal is an accounting adjustment regardless of
      // whether PayPal currently calls the recurring agreement ACTIVE,
      // SUSPENDED, CANCELLED or EXPIRED. Do not mutate subscription lifecycle
      // or advance its event watermark from a transaction-level event.
      // Provider-backed lifecycle reconciliation is a separate operation.
      await entities.PayPalWebhookEvent.update(ledger.id, {
        processing_state: 'failed',
        processed_at: new Date().toISOString(),
        last_error: 'Refund/reversal requires financial review; lifecycle status is unchanged',
      });
      return Response.json({
        error: 'PayPal financial adjustment requires reconciliation',
        reviewRequired: true,
      }, { status: 503 });
    }
    const newStatus = state(event.event_type, event.resource);
    if (newStatus) {
      const update: Record<string, unknown> = {
        status: newStatus,
        paypal_event_id: event.id,
        paypal_event_time: incomingEventTime,
      };
      if (newStatus === 'canceled') update.cancel_at_period_end = false;

      // Sale events do not contain the current subscription lifecycle. A
      // verified sale for an earlier billing period cannot activate a locally
      // pending subscription that PayPal now marks canceled or suspended.
      // A signed sale or activation event may arrive after a subscription has
      // been suspended, canceled, or refunded. Any transition to ACTIVE must
      // be confirmed against PayPal's current subscription state, not merely
      // an older event's status.
      // A delayed CANCELLED/SUSPENDED/FAILED event is not evidence that the
      // *current* recurring agreement is still canceled or unpaid. Verify
      // revocations too, not just activation; failed lookups stay retryable.
      const needsCurrentProviderStatus =
        newStatus === 'active' || newStatus === 'canceled' || newStatus === 'unpaid';
      const remoteSubscription = needsCurrentProviderStatus
        ? await fetchSubscriptionBillingInfo(token, subscriptionId)
        : null;
      // For pending activation the billing boundary must come from a fresh
      // provider read. A signed but delayed event may have an old future date.
      // Do not derive the period from stale event payloads when the provider
      // has a fresher lifecycle snapshot.
      const billingTime = remoteSubscription?.nextBillingTime;
      const periodEnd = paypalPeriodEndForStatus(newStatus, billingTime);
      const providerMismatch = needsCurrentProviderStatus &&
        (!remoteSubscription ||
          !remoteSubscription.planId ||
          remoteSubscription.planId !== record.paypal_plan_id ||
          typeof record.user_id !== 'string' ||
          typeof record.sku !== 'string' ||
          remoteSubscription.customId !== record.user_id + ':' + record.sku ||
          (newStatus === 'active' && remoteSubscription.status !== 'ACTIVE') ||
          (newStatus === 'canceled' &&
            remoteSubscription.status !== 'CANCELLED' &&
            remoteSubscription.status !== 'EXPIRED') ||
          (newStatus === 'unpaid' && remoteSubscription.status !== 'SUSPENDED'));
      // A canceled/unpaid subscription must not be restored to active without
      // a freshly verified future billing boundary. For an already ACTIVE
      // local row, the existing boundary remains in place if PayPal hasn't
      // supplied a newer one.
      const requiresRestorationBillingVerification = newStatus === 'active' &&
        record.status !== 'active' &&
        (typeof periodEnd !== 'string' || Date.parse(periodEnd) <= Date.now());
      if (providerMismatch || requiresRestorationBillingVerification ||
          requiresPayPalBillingVerification(record.status, newStatus, periodEnd)) {
        // Keep the ledger retryable so an incomplete event is not silently
        // acknowledged while its pending checkout has no verified paid period.
        await entities.PayPalWebhookEvent.update(ledger.id, {
          processing_state: 'failed',
          processed_at: new Date().toISOString(),
          last_error: 'Active PayPal subscription status, owner, plan, or billing period could not be verified',
        });
        return Response.json({ error: 'PayPal billing period verification required' }, { status: 503 });
      }
      if (periodEnd !== undefined && !(newStatus === 'active' && periodEnd === null)) {
        update.current_period_end = periodEnd;
      }
      // Preserve any prior billing boundary instead of converting it to null.
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