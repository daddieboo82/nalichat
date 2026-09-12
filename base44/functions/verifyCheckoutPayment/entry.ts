import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { stripeRequest } from '../../shared/stripe.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

// Client-side payment verification fallback — called from the ThankYou page.
// If the Stripe webhook already marked the purchase as paid, this is a no-op.
// If the webhook missed it, this fulfills the payment so the buyer gets access.
Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const { checkoutId, purchaseToken } = await req.json();

    const normalizedCheckoutId = String(checkoutId || '').trim();
    const normalizedPurchaseToken = String(purchaseToken || '').trim();
    if (
      !/^cs_(?:test_|live_)?[A-Za-z0-9_]{8,255}$/.test(normalizedCheckoutId)
      || !/^[0-9a-f]{64}$/.test(normalizedPurchaseToken)
    ) {
      return Response.json({ error: 'Invalid checkout verification data' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // Authorize against the local opaque verifier before making any Stripe API
    // request. This prevents the public fallback endpoint from becoming an
    // unauthenticated Stripe session-enumeration / API-amplification surface.
    const purchases = await base44.asServiceRole.entities.Base44Purchase.filter(
      { checkoutSessionId: normalizedCheckoutId },
      '-created_date',
      2,
    );
    if (purchases.length !== 1) {
      return Response.json({ error: 'Purchase record not found' }, { status: 404 });
    }
    const purchase = purchases[0];

    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(normalizedPurchaseToken),
    );
    const verifierHash = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    if (!purchase.purchase_verifier_hash || purchase.purchase_verifier_hash !== verifierHash) {
      return Response.json({ error: 'Invalid purchase verifier' }, { status: 403 });
    }

    const verifyRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      `purchase:${purchase.id}`,
      'checkout_verification',
      60,
    );
    if (!verifyRate.allowed) {
      return Response.json(
        { error: 'Checkout verification rate limit exceeded. Please try again later.' },
        { status: 429 },
      );
    }

    const session = await stripeRequest(`/checkout/sessions/${encodeURIComponent(normalizedCheckoutId)}`, {}, 'GET');
    if (!session) {
      return Response.json({ error: 'Checkout session not found' }, { status: 404 });
    }

    // 3. If Stripe says paid but our record is still pending, fulfill it now
    // (webhook may not have fired yet — this is the fallback path)
    if (session.payment_status === 'paid' && purchase.status !== 'paid') {
      await base44.asServiceRole.entities.Base44Purchase.update(purchase.id, {
        status: 'paid',
        stripe_payment_intent_id: session.payment_intent || null,
        stripe_customer_id: session.customer || null,
        paid_at: new Date().toISOString(),
      });
      console.log('Payment fulfilled via ThankYou fallback:', normalizedCheckoutId);
    }

    // 4. Return the current status so the UI can show the right state
    return Response.json({
      status: purchase.status === 'paid' ? 'paid' : session.payment_status,
      items: purchase.items || [],
    });
  } catch (error) {
    console.error('verifyCheckoutPayment error:', error);
    return Response.json({ error: 'Checkout verification failed' }, { status: 500 });
  }
});
