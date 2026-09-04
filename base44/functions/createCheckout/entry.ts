import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { stripeRequest } from '../../shared/stripe.ts';

Deno.serve(async (req) => {
  try {
    const { items, callbackUrls } = await req.json();

    const base44 = createClientFromRequest(req);
    let user;
    try {
      user = await base44.auth.me();
    } catch (_e) {
      // Checkout is public — storefront buyers may not have an account
    }

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return Response.json(
        { error: 'Items array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Validate callback URLs
    if (!callbackUrls?.thankYouPageUrl || !callbackUrls?.postFlowUrl) {
      return Response.json(
        { error: 'Both thankYouPageUrl and postFlowUrl are required' },
        { status: 400 }
      );
    }

    // Admin test bypass — skip Stripe and go straight to ThankYou (internal QA only)
    const isTestAccount = !!(user && user.role === 'admin');
    if (isTestAccount) {
      return Response.json({
        checkoutUrl: callbackUrls.thankYouPageUrl,
        checkoutId: 'test_checkout_' + Date.now(),
      });
    }

    // Map app items to Stripe line items (unit_amount is in cents)
    const lineItems = items.map((item: any) => ({
      price_data: {
        currency: 'usd',
        unit_amount: Math.round(Number(item.price) * 100),
        product_data: {
          name: item.name || item.title || 'Item',
        },
      },
      quantity: item.quantity || 1,
    }));

    const sessionParams: Record<string, any> = {
      mode: 'payment',
      line_items: lineItems,
      success_url: callbackUrls.thankYouPageUrl,
      cancel_url: callbackUrls.postFlowUrl,
    };

    if (user?.email) {
      sessionParams.customer_email = user.email;
    }

    const session = await stripeRequest('/checkout/sessions', sessionParams);

    // Persist the Stripe session ID so the webhook can correlate the payment
    try {
      await base44.asServiceRole.entities.Base44Purchase.create({
        checkoutSessionId: session.id,
        status: 'pending',
        user_id: user?.id || null,
        user_email: user?.email || null,
        items: items.map((item: any) => ({
          ...item,
          price: Number(item.price).toFixed(2),
        })),
      });
    } catch (e) {
      console.error('Failed to persist Base44Purchase:', e);
    }

    return Response.json({
      checkoutUrl: session.url,
      checkoutId: session.id,
    });
  } catch (error) {
    console.error('Checkout error:', error.message);
    return Response.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
});