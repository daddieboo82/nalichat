import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // The app is completely free — no paid subscriptions.
    // Redirect users to the ThankYou page (which clears the cart) without charging.
    const url = new URL(req.url);
    const appUrl = req.headers.get('X-Base44-App-Url') || `${url.protocol}//${url.host}`;

    return Response.json({
      freeAccess: true,
      checkoutUrl: `${appUrl}/ThankYou`,
    });
  } catch (error) {
    console.error('Subscription checkout error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});