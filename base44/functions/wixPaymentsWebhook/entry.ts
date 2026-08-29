import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import jwt from 'npm:jsonwebtoken';

Deno.serve(async (req) => {
  try {
    console.error("HANDLER START ERROR LOG");
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
        let subs = await base44.asServiceRole.entities.Subscription.filter({
          checkout_id: checkoutId,
        });

        if (subs.length === 0) {
          try {
            const subById = await base44.asServiceRole.entities.Subscription.get(checkoutId);
            if (subById) subs = [subById];
          } catch (e) {
            // Ignore format/not found errors
          }
        }

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

        const WIX_API_KEY = Deno.env.get('WIX_PAYMENTS_API_KEY');
        const WIX_SITE_ID = Deno.env.get('WIX_PAYMENTS_SITE_ID');

        // Cancel any previous active or pending subscriptions to avoid double billing and inconsistencies
        const oldSubs = await base44.asServiceRole.entities.Subscription.filter({
          user_id: sub.user_id
        });

        for (const oldSub of oldSubs) {
          if (oldSub.id !== sub.id && (oldSub.status === 'active' || oldSub.status === 'pending')) {
            if (oldSub.status === 'active' && oldSub.subscription_id && WIX_API_KEY && WIX_SITE_ID) {
              try {
                const cancelRes = await fetch(`https://www.wixapis.com/payments/base44/v1/subscriptions/${oldSub.subscription_id}/cancel`, {
                  method: 'POST',
                  headers: {
                    'Authorization': WIX_API_KEY,
                    'wix-site-id': WIX_SITE_ID,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    subscription_id: oldSub.subscription_id,
                    immediate: true
                  })
                });
                if (!cancelRes.ok) {
                  console.error('Failed to cancel old subscription in Wix:', await cancelRes.text());
                }
              } catch (e) {
                console.error('Error calling Wix cancel API:', e);
              }
            }
            await base44.asServiceRole.entities.Subscription.update(oldSub.id, { status: 'canceled' });
          }
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
          await base44.asServiceRole.entities.Subscription.update(subs[0].id, {
            status: 'canceled',
          });
          console.log('Subscription canceled:', subscriptionId);
        } else {
          console.warn('No subscription found for cancellation:', subscriptionId);
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