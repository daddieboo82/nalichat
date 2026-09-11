import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import jwt from 'npm:jsonwebtoken';

// Legacy compatibility only. New subscription checkout is Stripe-only.
Deno.serve(async (req) => {
  try {
    // Security: Only POST allowed
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const bodyText = await req.text();
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
    const WEBHOOK_PUBLIC_KEY = Deno.env.get('WIX_PAYMENTS_WEBHOOK_PUBLIC_KEY')?.replace(/\\n/g, '\n');
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

    console.log('Wix webhook received:', event.eventType || 'unknown');

    // New subscription checkout is Stripe-only. Do not activate or mutate
    // entitlements from legacy Wix order-approved events. We still accept the
    // signed webhook so Wix does not retry forever, while cancellation/expiry
    // events below continue to retire existing legacy Wix subscriptions.
    if (event.eventType === 'wix.ecom.v1.order_approved') {
      console.warn('Ignoring legacy Wix order approval; Stripe is the subscription system of record');
      return Response.json({ success: true, ignored: true });
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

        let subs = await base44.asServiceRole.entities.Subscription.filter({
          subscription_id: subscriptionId,
        });

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
        return Response.json({ error: err.message }, { status: 500 });
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

        let subs = await base44.asServiceRole.entities.Subscription.filter({
          subscription_id: subscriptionId,
        });

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
        return Response.json({ error: err.message }, { status: 500 });
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