import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { stripeRequest } from '../../shared/stripe.ts';

Deno.serve(async (req) => {
  try {
    const { plan, callbackUrls } = await req.json();

    const base44 = createClientFromRequest(req);
    let user;
    try {
      user = await base44.auth.me();
    } catch (_e) {
      return Response.json({ error: 'Authentication required for subscriptions' }, { status: 401 });
    }

    if (!callbackUrls?.thankYouPageUrl || !callbackUrls?.postFlowUrl) {
      return Response.json(
        { error: 'Both thankYouPageUrl and postFlowUrl are required' },
        { status: 400 }
      );
    }

    const separator = callbackUrls.thankYouPageUrl.includes('?') ? '&' : '?';
    const successUrl = `${callbackUrls.thankYouPageUrl}${separator}subscription=1&checkout_id={CHECKOUT_SESSION_ID}`;

    const sessionParams: Record<string, any> = {
      mode: 'subscription',
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: 1999,
          recurring: { interval: 'month', interval_count: 1 },
          product_data: { name: 'NaliChat App Access' },
        },
        quantity: 1,
      }],
      success_url: successUrl,
      cancel_url: callbackUrls.postFlowUrl,
    };

    if (user?.email) {
      sessionParams.customer_email = user.email;
    }

    const session = await stripeRequest('/checkout/sessions', sessionParams);

    // Create a pending Subscription record — the webhook activates it on payment
    try {
      await base44.asServiceRole.entities.Subscription.create({
        user_id: user.id,
        plan: plan || 'pro',
        status: 'pending',
        checkout_id: session.id,
      });
    } catch (e) {
      console.error('Failed to create Subscription record:', e);
    }

    return Response.json({
      checkoutUrl: session.url,
      checkoutId: session.id,
    });
  } catch (error) {
    console.error('Subscription checkout error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});