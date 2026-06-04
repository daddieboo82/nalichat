import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    // Security: Only POST allowed
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    // Security: Verify request came from Wix (basic check)
    const authorization = req.headers.get('authorization');
    if (!authorization) {
      console.warn('Webhook received without authorization header');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.text();
    if (!body || body.trim().length === 0) {
      return Response.json({ error: 'Empty request body' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // Parse the webhook payload
    let event;
    try {
      event = JSON.parse(body);
    } catch {
      console.error('Failed to parse webhook body');
      return Response.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    console.log('Wix webhook received:', event.eventType || 'unknown');

    // Handle order approved (subscription activated)
    if (event.eventType === 'wix.ecom.v1.order_approved') {
      try {
        const checkoutId = event.data?.order?.checkoutId;
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
        const subscriptionId = event.data?.order?.lineItems?.[0]?.subscriptionInfo?.id;

        if (!subscriptionId) {
          console.warn('No subscriptionInfo.id in order');
          return Response.json({ success: true });
        }

        // Validate user exists before updating
        const user = await base44.asServiceRole.entities.User.get(sub.user_id).catch(() => null);
        if (!user) {
          console.error('Subscription user not found:', sub.user_id);
          return Response.json({ success: true });
        }

        // Update subscription to active with Wix ID
        await base44.asServiceRole.entities.Subscription.update(sub.id, {
          status: 'active',
          subscription_id: subscriptionId,
          plan: 'pro',
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
        const subscriptionId = event.data?.subscriptionContract?.id;
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
        const subscriptionId = event.data?.subscriptionContract?.id;
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