import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import jwt from 'npm:jsonwebtoken';

Deno.serve(async (req) => {
  try {
    // Security: Only POST allowed
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const body = await req.text();
    if (!body || body.trim().length === 0) {
      return Response.json({ error: 'Empty request body' }, { status: 400 });
    }

    const WEBHOOK_PUBLIC_KEY = Deno.env.get('WIX_PAYMENTS_WEBHOOK_PUBLIC_KEY');
    if (!WEBHOOK_PUBLIC_KEY) {
      console.error('Missing WIX_PAYMENTS_WEBHOOK_PUBLIC_KEY');
      return Response.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    const base44 = createClientFromRequest(req);

    let rawPayload;
    try {
      rawPayload = jwt.verify(body, WEBHOOK_PUBLIC_KEY, { algorithms: ["RS256"] });
    } catch (err) {
      console.error('JWT verification failed', err);
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let event;
    let eventData;
    try {
      event = JSON.parse(rawPayload.data);
      eventData = JSON.parse(event.data);
    } catch {
      console.error('Failed to parse webhook body');
      return Response.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    console.log('Wix webhook received:', event.eventType || 'unknown');

    // Handle order approved (subscription activated)
    if (event.eventType === 'wix.ecom.v1.order_approved') {
      try {
        const order = eventData.actionEvent.body.order;
        const checkoutId = order?.checkoutId;
        if (!checkoutId) {
          console.warn('No checkoutId in order_approved event');
          return Response.json({ success: true });
        }

        // Find the pending subscription by checkout ID
        const subs = await base44.asServiceRole.entities.Subscription.filter({
          checkout_id: checkoutId,
        });

        if (subs.length === 0) {
          console.warn('No pending subscription found for checkout:', checkoutId);
          return Response.json({ success: true });
        }

        const sub = subs[0];
        let subscriptionId = null;
        for (const lineItem of order.lineItems || []) {
          if (lineItem.subscriptionInfo) {
            subscriptionId = lineItem.subscriptionInfo.id;
            break;
          }
        }

        // For recurring subscriptions, we expect an ID. 
        if (sub.plan !== 'trial' && !subscriptionId) {
          console.warn('No subscriptionInfo.id in order');
          // It's possible it was a one-time product without subscription, but we'll activate it anyway
        }

        // Update subscription to active
        await base44.asServiceRole.entities.Subscription.update(sub.id, {
          status: 'active',
          subscription_id: subscriptionId || null,
        });

        console.log('Subscription activated for user:', sub.user_id);
        return Response.json({ success: true });
      } catch (err) {
        console.error('Order approved handler error:', err);
        return Response.json({ success: true }); // Still ack to prevent retries
      }
    }

    // Handle subscription canceled
    if (event.eventType === 'wix.ecom.subscription_contracts.v1.subscription_contract_canceled') {
      try {
        const subscriptionContract = eventData.actionEvent.body.subscriptionContract;
        const subscriptionId = subscriptionContract?.id;
        if (!subscriptionId) {
          console.warn('No subscription ID in cancel event');
          return Response.json({ success: true });
        }

        const subs = await base44.asServiceRole.entities.Subscription.filter({
          subscription_id: subscriptionId,
        });

        if (subs.length > 0) {
          await base44.asServiceRole.entities.Subscription.update(subs[0].id, {
            status: 'canceled',
          });
          console.log('Subscription canceled:', subscriptionId);
        }

        return Response.json({ success: true });
      } catch (err) {
        console.error('Subscription cancel handler error:', err);
        return Response.json({ success: true });
      }
    }

    // Handle subscription expired
    if (event.eventType === 'wix.ecom.subscription_contracts.v1.subscription_contract_expired') {
      try {
        const subscriptionContract = eventData.actionEvent.body.subscriptionContract;
        const subscriptionId = subscriptionContract?.id;
        if (!subscriptionId) {
          console.warn('No subscription ID in expire event');
          return Response.json({ success: true });
        }

        const subs = await base44.asServiceRole.entities.Subscription.filter({
          subscription_id: subscriptionId,
        });

        if (subs.length > 0) {
          await base44.asServiceRole.entities.Subscription.update(subs[0].id, {
            status: 'ended',
          });
          console.log('Subscription ended:', subscriptionId);
        }

        return Response.json({ success: true });
      } catch (err) {
        console.error('Subscription expire handler error:', err);
        return Response.json({ success: true });
      }
    }

    // Unknown event type - still return 200 to ack receipt
    console.log('Unknown webhook type:', event.eventType);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});