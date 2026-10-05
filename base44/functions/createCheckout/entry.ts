import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { stripeRequest } from '../../shared/stripe.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import {
  checkoutErrorMessage as errorMessage,
  isCheckoutClientError as isClientError,
  randomVerifier,
  sha256Hex,
  anonymousCheckoutScope,
  allowedCheckoutOrigins,
  validateCallbackUrl,
} from '../../shared/checkoutHelpers.ts';

// Server-side price catalog — never trust client-supplied prices
const DONATION_PRESETS = [5, 10, 25, 50];
const MAX_CHECKOUT_ITEMS = 10;
const MAX_TOTAL_DONATION_CENTS = 500_000;


Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }
    const { items, callbackUrls } = await readJsonBodyLimited(req, 32 * 1024);

    const base44 = createClientFromRequest(req);
    let user;
    try {
      user = await base44.auth.me();
    } catch (_e) {
      // Checkout is public — storefront buyers may not have an account
    }

    const checkoutScope = user?.id || await anonymousCheckoutScope(req);
    const checkoutLimit = user?.id ? 60 : 20;
    const checkoutRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      checkoutScope,
      'checkout_create',
      checkoutLimit,
    );
    if (!checkoutRate.allowed) {
      return Response.json(
        { error: 'Too many checkout attempts. Please try again later.' },
        { status: 429 },
      );
    }

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0 || items.length > MAX_CHECKOUT_ITEMS) {
      return Response.json(
        { error: `Items array must contain between 1 and ${MAX_CHECKOUT_ITEMS} items` },
        { status: 400 }
      );
    }

    // Validate callback URLs against server-controlled allowed origins.
    if (!callbackUrls?.thankYouPageUrl || !callbackUrls?.postFlowUrl) {
      return Response.json(
        { error: 'Both thankYouPageUrl and postFlowUrl are required' },
        { status: 400 }
      );
    }
    const allowedOrigins = allowedCheckoutOrigins();
    if (allowedOrigins.size === 0) {
      return Response.json({ error: 'Checkout callback origins are not configured' }, { status: 500 });
    }
    let thankYouPageUrl: string;
    let postFlowUrl: string;
    try {
      thankYouPageUrl = validateCallbackUrl(callbackUrls.thankYouPageUrl, allowedOrigins);
      postFlowUrl = validateCallbackUrl(callbackUrls.postFlowUrl, allowedOrigins);
    } catch (error) {
      return Response.json({ error: errorMessage(error) }, { status: 400 });
    }

    // Resolve each item's price server-side — never trust client-supplied prices
    const lineItems = [];
    const persistedItems = [];
    let totalCents = 0;

    for (const item of items) {
      let unitPrice: number;
      let name: string;
      const quantity = Math.min(Math.max(Math.floor(Number(item.quantity)) || 1, 1), 99);

      if (item.type === 'donation') {
        // Donation — validate amount against server-side preset list
        const amount = Number(item.amount);
        if (!DONATION_PRESETS.includes(amount)) {
          return Response.json(
            { error: 'Invalid donation amount' },
            { status: 400 }
          );
        }
        unitPrice = amount;
        name = 'Donation to NaliBase';
      } else {
        return Response.json(
          { error: 'Only donation checkout is supported' },
          { status: 400 }
        );
      }

      const unitAmountCents = Math.round(unitPrice * 100);
      totalCents += unitAmountCents * quantity;
      if (totalCents > MAX_TOTAL_DONATION_CENTS) {
        return Response.json({ error: 'Checkout total exceeds the allowed limit' }, { status: 400 });
      }

      lineItems.push({
        price_data: {
          currency: 'usd',
          unit_amount: unitAmountCents,
          product_data: { name },
        },
        quantity,
      });

      persistedItems.push({
        name,
        price: unitPrice.toFixed(2),
        quantity,
        ...(item.type ? { type: item.type } : {}),
      });
    }

    // Bind the public verification fallback to an opaque return verifier.
    // Only its SHA-256 hash is stored server-side.
    const purchaseVerifier = randomVerifier();
    const purchaseVerifierHash = await sha256Hex(purchaseVerifier);
    const successUrl = new URL(thankYouPageUrl);
    successUrl.searchParams.set('checkout_id', '{CHECKOUT_SESSION_ID}');
    successUrl.searchParams.set('purchase_token', purchaseVerifier);

    const sessionParams: Record<string, any> = {
      mode: 'payment',
      line_items: lineItems,
      success_url: successUrl.toString(),
      cancel_url: postFlowUrl,
    };

    if (user?.email) {
      sessionParams.customer_email = user.email;
    }

    const session = await stripeRequest('/checkout/sessions', sessionParams);

    // Persist the Stripe session ID before redirecting the buyer. If this fails,
    // expire the Stripe session so we never accept a payment that cannot be
    // correlated and fulfilled by our webhook/return flow.
    try {
      await base44.asServiceRole.entities.Base44Purchase.create({
        checkoutSessionId: session.id,
        status: 'pending',
        user_id: user?.id || null,
        user_email: user?.email || null,
        items: persistedItems,
        purchase_verifier_hash: purchaseVerifierHash,
      });
    } catch (error) {
      console.error('Failed to persist Base44Purchase:', error);
      try {
        await stripeRequest(`/checkout/sessions/${encodeURIComponent(session.id)}/expire`, {}, 'POST');
      } catch (expireError) {
        console.error('Failed to expire orphaned checkout session:', expireError);
      }
      throw new Error('Unable to initialize purchase record');
    }

    return Response.json({
      checkoutUrl: session.url,
      checkoutId: session.id,
    });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    const message = errorMessage(error);
    console.error('Checkout error:', error);
    return Response.json(
      { error: isClientError(message) ? message : 'Unable to create checkout session' },
      { status: isClientError(message) ? 400 : 500 }
    );
  }
});