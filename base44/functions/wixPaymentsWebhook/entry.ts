import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { readTextBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import jwt from 'npm:jsonwebtoken';
import { secrets } from 'base44:runtime';

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

// Legacy compatibility only. New subscription checkout is Stripe-only.
Deno.serve(async (req) => {
  let wixEventEntity: any = null;
  let wixEventClaimId: string | null = null;
  try {
    // Security: Only POST allowed
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const bodyText = await readTextBodyLimited(req, 1024 * 1024);
    let body = bodyText;
    try {
      const parsed = JSON.parse(bodyText);
      if (parsed.data) {
        body = typeof parsed.data === 'string' ? parsed.data : JSON.stringify(parsed.data);
      }
    } catch {
      // not JSON, keep as is
    }
    if (typeof body === 'string') {
      body = body.replace(/^"|"$/g, '').trim();
    }
    if (!body || body.length === 0) {
      return Response.json({ error: 'Empty request body' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // Security: always verify the JWT signature — no test bypass
    const WEBHOOK_PUBLIC_KEY = (secrets.get('WIX_CHECKOUT_WEBHOOK_PUBLIC_KEY') || secrets.get('WIX_PAYMENTS_WEBHOOK_PUBLIC_KEY'))?.replace(/\\n/g, '\n');
    if (!WEBHOOK_PUBLIC_KEY) {
      console.error('Missing WIX_PAYMENTS_WEBHOOK_PUBLIC_KEY');
      return Response.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    let event;
    let eventData;
    let rawPayload;
    try {
      rawPayload = jwt.verify(body, WEBHOOK_PUBLIC_KEY, { algorithms: ["RS256"] });
    } catch (err) {
      console.error('JWT verification failed', err);
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      event = JSON.parse(rawPayload.data);
      eventData = JSON.parse(event.data);
    } catch {
      console.error('Failed to parse webhook body');
      return Response.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const eventType = String(event?.eventType || '');
    const wixEventId = typeof eventData?.id === 'string' && eventData.id
      ? eventData.id
      : `legacy:${await sha256Hex(`${eventType}:${event?.data || ''}`)}`;
    wixEventEntity = base44.asServiceRole.entities.WixWebhookEvent;
    const existingEvents = await wixEventEntity.filter(
      { wix_event_id: wixEventId },
      '-created_date',
      1,
    );
    if (existingEvents[0]) {
      return Response.json({ success: true, duplicate: true });
    }
    try {
      await wixEventEntity.create({
        id: wixEventId,
        wix_event_id: wixEventId,
        event_type: eventType || 'unknown',
        event_time: String(eventData?.eventTime || ''),
        claimed_at: new Date().toISOString(),
      });
      wixEventClaimId = wixEventId;
    } catch {
      const claimed = await wixEventEntity.filter(
        { wix_event_id: wixEventId },
        '-created_date',
        1,
      );
      if (claimed[0]) {
        return Response.json({ success: true, duplicate: true });
      }
      throw new Error('Unable to claim Wix webhook event');
    }

    console.log('Wix webhook received:', eventType || 'unknown');

    // Activate subscriptions created via Wix (Base44 Payments) checkout.
    // The order_approved webhook is the first time we see subscriptionInfo.id,
    // so we correlate via order.checkoutId → our pending Subscription record,
    // attach the subscription ID, and flip the status to active.
    if (eventType === 'wix.ecom.v1.order_approved') {
      try {
        const order = eventData.actionEvent?.body?.order;
        const checkoutId = order?.checkoutId;
        if (!checkoutId) {
          console.warn('No checkoutId in order approved event');
          return Response.json({ success: true });
        }

        // Extract subscription ID from line items
        let subscriptionId: string | null = null;
        if (Array.isArray(order?.lineItems)) {
          for (const lineItem of order.lineItems) {
            if (lineItem?.subscriptionInfo?.id) {
              subscriptionId = lineItem.subscriptionInfo.id;
              break;
            }
          }
        }

        // Find the Subscription by checkout_id
        const subs = await base44.asServiceRole.entities.Subscription.filter(
          { checkout_id: checkoutId }, '-created_date', 1,
        );
        const sub = subs[0];

        if (sub) {
          if (sub.provider && sub.provider !== 'wix') {
            console.warn('Ignoring Wix order approval for non-Wix subscription:', checkoutId);
            return Response.json({ success: true });
          }
          // Idempotent: only activate if not already active
          if (sub.status !== 'active') {
            await base44.asServiceRole.entities.Subscription.update(sub.id, {
              status: 'active',
              provider: 'wix',
              subscription_id: subscriptionId || sub.subscription_id,
            });
            console.log('Subscription activated via Wix:', sub.id, 'checkoutId:', checkoutId, 'subscriptionId:', subscriptionId);
          }
        } else {
          console.warn('No subscription found for Wix checkoutId:', checkoutId);
        }

        // Mark the Base44Purchase as paid (idempotent)
        try {
          const purchases = await base44.asServiceRole.entities.Base44Purchase.filter(
            { checkoutSessionId: checkoutId }, '-created_date', 1,
          );
          if (purchases[0] && purchases[0].status !== 'paid') {
            await base44.asServiceRole.entities.Base44Purchase.update(purchases[0].id, {
              status: 'paid',
              paid_at: new Date().toISOString(),
            });
          }
        } catch (purchaseError) {
          console.error('Failed to mark Base44Purchase as paid for Wix checkout:', checkoutId, purchaseError);
        }

        return Response.json({ success: true });
      } catch (err) {
        console.error('Wix order approved handler error:', err);
        throw err;
      }
    }

    // Handle subscription canceled
    if (eventType === 'wix.ecom.subscription_contracts.v1.subscription_contract_canceled') {
      try {
        const subscriptionContract = eventData.actionEvent.body.subscriptionContract;
        const subscriptionId = subscriptionContract?.id;
        if (!subscriptionId) {
          console.warn('No subscription ID in cancel event');
          return Response.json({ success: true });
        }

        let subs = await base44.asServiceRole.entities.Subscription.filter(
          { subscription_id: subscriptionId },
          '-created_date',
          1,
        );

        if (subs.length === 0) {
          // Fallback to internal ID for automated testing environments
          try {
            const subById = await base44.asServiceRole.entities.Subscription.get(subscriptionId);
            if (subById) {
              subs = [subById];
            }
          } catch (e) {
            // Ignore invalid id format or not found errors
          }
        }

        if (subs.length > 0) {
          if (subs[0].provider && subs[0].provider !== 'wix') {
            console.warn('Ignoring Wix cancellation for non-Wix subscription:', subscriptionId);
            return Response.json({ success: true });
          }
          await base44.asServiceRole.entities.Subscription.update(subs[0].id, {
            status: 'canceled',
            provider: 'wix',
          });
          console.log('Subscription canceled:', subscriptionId);
        } else {
          console.warn('No subscription found for cancellation:', subscriptionId);
        }

        return Response.json({ success: true });
      } catch (err) {
        console.error('Subscription cancel handler error:', err);
        throw err;
      }
    }

    // Handle subscription expired
    if (eventType === 'wix.ecom.subscription_contracts.v1.subscription_contract_expired') {
      try {
        const subscriptionContract = eventData.actionEvent.body.subscriptionContract;
        const subscriptionId = subscriptionContract?.id;
        if (!subscriptionId) {
          console.warn('No subscription ID in expire event');
          return Response.json({ success: true });
        }

        let subs = await base44.asServiceRole.entities.Subscription.filter(
          { subscription_id: subscriptionId },
          '-created_date',
          1,
        );

        if (subs.length === 0) {
          try {
            const subById = await base44.asServiceRole.entities.Subscription.get(subscriptionId);
            if (subById) {
              subs = [subById];
            }
          } catch (e) {
            // Ignore invalid id format or not found errors
          }
        }

        if (subs.length > 0) {
          if (subs[0].provider && subs[0].provider !== 'wix') {
            console.warn('Ignoring Wix expiration for non-Wix subscription:', subscriptionId);
            return Response.json({ success: true });
          }
          await base44.asServiceRole.entities.Subscription.update(subs[0].id, {
            status: 'ended',
            provider: 'wix',
          });
          console.log('Subscription ended:', subscriptionId);
        }

        return Response.json({ success: true });
      } catch (err) {
        console.error('Subscription expire handler error:', err);
        throw err;
      }
    }

    // Unknown event type - still return 200 to ack receipt
    console.log('Unknown webhook type:', eventType);
    return Response.json({ success: true });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('Webhook error:', error);
    if (wixEventEntity && wixEventClaimId) {
      try {
        await wixEventEntity.delete(wixEventClaimId);
      } catch (releaseError) {
        console.error('Failed to release Wix webhook replay claim:', releaseError);
      }
    }
    return Response.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
});