import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const origin = req.headers.get('origin') || '';
    const WIX_API_KEY = Deno.env.get('WIX_PAYMENTS_API_KEY');
    const WIX_SITE_ID = Deno.env.get('WIX_PAYMENTS_SITE_ID');

    if (!WIX_API_KEY || !WIX_SITE_ID) {
      console.error('Missing Wix Payments credentials');
      return Response.json({ error: 'Payment setup incomplete' }, { status: 500 });
    }

    // Create checkout session with subscription
    const checkoutResponse = await fetch('https://www.wixapis.com/payments/base44/v1/checkout-sessions', {
      method: 'POST',
      headers: {
        'Authorization': WIX_API_KEY,
        'wix-site-id': WIX_SITE_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cart: {
          items: [
            {
              name: 'NaliChat Pro — 7 Day Free Trial',
              description: 'Unlimited projects, AI mastering, collaboration, and more',
              quantity: 1,
              price: '0.00',
              lineItemType: 'SUBSCRIPTION',
              subscriptionInfo: {
                name: 'NaliChat Pro',
                billingCycle: {
                  interval: 'MONTH',
                  count: 1,
                  trialDays: 7, // 7-day free trial
                },
                paymentPlan: {
                  name: '$9.99/month',
                  price: '9.99',
                },
              },
            },
          ],
          customerInfo: {
            email: user.email,
          },
        },
        callbackUrls: {
          thankYouPageUrl: `${origin}/thank-you`,
          errorUrl: `${origin}/`,
        },
      }),
    });

    if (!checkoutResponse.ok) {
      const err = await checkoutResponse.text();
      console.error('Checkout creation failed:', err);
      return Response.json({ error: 'Failed to create checkout' }, { status: 500 });
    }

    const checkoutData = await checkoutResponse.json();
    const checkoutId = checkoutData.checkoutSession?.id;

    if (!checkoutId) {
      console.error('No checkout ID returned');
      return Response.json({ error: 'Invalid checkout response' }, { status: 500 });
    }

    // Create pending subscription record
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 7);

    await base44.asServiceRole.entities.Subscription.create({
      user_id: user.id,
      plan: 'pro',
      status: 'trial',
      checkout_id: checkoutId,
      trial_end_date: trialEndDate.toISOString(),
    });

    return Response.json({
      checkoutUrl: checkoutData.checkoutSession?.checkoutUrl,
      checkoutId,
    });
  } catch (error) {
    console.error('Subscription checkout error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});