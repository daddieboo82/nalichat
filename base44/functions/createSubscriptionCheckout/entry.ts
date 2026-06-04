import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get user - may be null for public app
    let user;
    try {
      user = await base44.auth.me();
    } catch (e) {
      // User not authenticated
    }

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get origin from request header
    const url = new URL(req.url);
    const origin = req.headers.get('origin') || `${url.protocol}//${url.host}`;
    
    const WIX_API_KEY = Deno.env.get('WIX_PAYMENTS_API_KEY');
    const WIX_SITE_ID = Deno.env.get('WIX_PAYMENTS_SITE_ID');

    if (!WIX_API_KEY || !WIX_SITE_ID) {
      console.error('Missing Wix Payments credentials:', { WIX_API_KEY: !!WIX_API_KEY, WIX_SITE_ID: !!WIX_SITE_ID });
      return Response.json({ error: 'Payment setup incomplete' }, { status: 500 });
    }

    const bodyParams = await req.json().catch(() => ({}));
    const planType = bodyParams.plan || 'pro';

    let item;
    if (planType === 'trial') {
      item = {
        name: 'NaliChat 24-Hour Trial',
        description: 'Full access for 24 hours',
        quantity: 1,
        price: '0.99',
      };
    } else {
      item = {
        name: 'NaliChat Pro',
        description: 'Full access to all app features',
        quantity: 1,
        price: '24.95',
        lineItemType: 'SUBSCRIPTION',
        subscriptionInfo: {
          name: 'NaliChat Pro',
          billingCycle: {
            interval: 'MONTH',
            count: 1,
          },
          paymentPlan: {
            name: '$24.95/month',
            price: '24.95',
          },
        },
      };
    }

    // Create checkout session
    const checkoutPayload = {
      cart: {
        items: [item],
        customerInfo: {
          email: user.email,
        },
      },
      callbackUrls: {
        thankYouPageUrl: `${origin}/thank-you`,
        errorUrl: `${origin}/`,
      },
    };

    console.log('Creating checkout with payload:', JSON.stringify(checkoutPayload));

    const checkoutResponse = await fetch('https://www.wixapis.com/payments/base44/v1/checkout-sessions', {
      method: 'POST',
      headers: {
        'Authorization': WIX_API_KEY,
        'wix-site-id': WIX_SITE_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(checkoutPayload),
    });

    const responseText = await checkoutResponse.text();
    console.log('Checkout response status:', checkoutResponse.status);
    console.log('Checkout response body:', responseText);

    if (!checkoutResponse.ok) {
      console.error('Checkout creation failed with status', checkoutResponse.status, ':', responseText);
      return Response.json({ error: 'Failed to create checkout', details: responseText }, { status: 500 });
    }

    let checkoutData;
    try {
      checkoutData = JSON.parse(responseText);
    } catch {
      console.error('Failed to parse checkout response');
      return Response.json({ error: 'Invalid checkout response' }, { status: 500 });
    }

    const checkoutId = checkoutData.checkoutSession?.id;
    const checkoutUrl = checkoutData.checkoutSession?.checkoutUrl;

    if (!checkoutId || !checkoutUrl) {
      console.error('Missing checkout ID or URL in response:', checkoutData);
      return Response.json({ error: 'Invalid checkout response' }, { status: 500 });
    }

    // Create pending subscription record
    const trialEndDate = new Date();
    if (planType === 'trial') {
      trialEndDate.setHours(trialEndDate.getHours() + 24);
    } else {
      // For Pro, we just set a far future date if it's not a free trial,
      // but if we don't have free trial for Pro, we just don't need trial_end_date.
      trialEndDate.setDate(trialEndDate.getDate() + 30);
    }

    try {
      await base44.asServiceRole.entities.Subscription.create({
        user_id: user.id,
        plan: planType,
        status: 'pending',
        checkout_id: checkoutId,
        trial_end_date: trialEndDate.toISOString(),
      });
      console.log('Created subscription record for user:', user.id);
    } catch (dbError) {
      console.error('Failed to create subscription record:', dbError);
      // Don't fail the whole request if DB write fails - user can still checkout
    }

    console.log('Checkout created successfully:', checkoutId);
    return Response.json({
      checkoutUrl,
      checkoutId,
    });
  } catch (error) {
    console.error('Subscription checkout error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});