import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { stripeRequest } from '../../shared/stripe.ts';

// Client-side payment verification fallback — called from the ThankYou page.
// If the Stripe webhook already marked the purchase as paid, this is a no-op.
// If the webhook missed it, this fulfills the payment so the buyer gets access.
Deno.serve(async (req) => {
  try {
    const { checkoutId } = await req.json();

    if (!checkoutId) {
      return Response.json({ error: 'checkoutId is required' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // 1. Retrieve the Stripe checkout session to check payment status
    const session = await stripeRequest(`/checkout/sessions/${checkoutId}`, {}, 'GET');

    if (!session) {
      return Response.json({ error: 'Checkout session not found' }, { status: 404 });
    }

    // 2. Find the Base44Purchase by checkoutSessionId
    const purchases = await base44.asServiceRole.entities.Base44Purchase.filter({
      checkoutSessionId: checkoutId,
    });

    if (purchases.length === 0) {
      return Response.json({ error: 'Purchase record not found' }, { status: 404 });
    }

    const purchase = purchases[0];

    // 3. If Stripe says paid but our record is still pending, fulfill it now
    // (webhook may not have fired yet — this is the fallback path)
    if (session.payment_status === 'paid' && purchase.status !== 'paid') {
      await base44.asServiceRole.entities.Base44Purchase.update(purchase.id, {
        status: 'paid',
        stripe_payment_intent_id: session.payment_intent || null,
        stripe_customer_id: session.customer || null,
        paid_at: new Date().toISOString(),
      });
      console.log('Payment fulfilled via ThankYou fallback:', checkoutId);
    }

    // 4. Return the current status so the UI can show the right state
    return Response.json({
      status: purchase.status === 'paid' ? 'paid' : session.payment_status,
      items: purchase.items || [],
    });
  } catch (error) {
    console.error('verifyCheckoutPayment error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});