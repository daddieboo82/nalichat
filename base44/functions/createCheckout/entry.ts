import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { stripeRequest } from '../../shared/stripe.ts';

// Server-side price catalog — never trust client-supplied prices
const DONATION_PRESETS = [5, 10, 25, 50];
const DESKTOP_DOWNLOAD_PRICES: Record<string, { price: number; name: string }> = {
  desktop_download_windows: { price: 9.99, name: 'NaliChat for Windows' },
  desktop_download_macos: { price: 9.99, name: 'NaliChat for macOS' },
};

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

    // Resolve each item's price server-side — never trust client-supplied prices
    const lineItems = [];
    const persistedItems = [];

    for (const item of items) {
      let unitPrice: number;
      let name: string;
      const quantity = Math.min(Math.max(Math.floor(Number(item.quantity)) || 1, 1), 99);

      if (item.id) {
        // Entity-backed item (ArtPost) — look up price from DB
        let record;
        try {
          record = await base44.asServiceRole.entities.ArtPost.get(item.id);
        } catch (_e) {
          // Not found
        }
        if (!record) {
          return Response.json(
            { error: `Item not found: ${item.id}` },
            { status: 400 }
          );
        }
        unitPrice = Number(record.price) || 0;
        name = record.title || record.name || 'Item';
      } else if (item.type === 'donation') {
        // Donation — validate amount against server-side preset list
        const amount = Number(item.amount);
        if (!DONATION_PRESETS.includes(amount)) {
          return Response.json(
            { error: 'Invalid donation amount' },
            { status: 400 }
          );
        }
        unitPrice = amount;
        name = 'Donation to NaliChat';
      } else if (item.type && item.type in DESKTOP_DOWNLOAD_PRICES) {
        unitPrice = DESKTOP_DOWNLOAD_PRICES[item.type].price;
        name = DESKTOP_DOWNLOAD_PRICES[item.type].name;
      } else {
        return Response.json(
          { error: 'Item must have an id or a valid type' },
          { status: 400 }
        );
      }

      lineItems.push({
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(unitPrice * 100),
          product_data: { name },
        },
        quantity,
      });

      persistedItems.push({
        name,
        price: unitPrice.toFixed(2),
        quantity,
        ...(item.id ? { id: item.id, type: 'stem_license' } : {}),
        ...(item.type ? { type: item.type } : {}),
      });
    }

    // Append Stripe's {CHECKOUT_SESSION_ID} placeholder so the ThankYou page
    // can verify the payment even if the webhook hasn't fired yet.
    const separator = callbackUrls.thankYouPageUrl.includes('?') ? '&' : '?';
    const successUrl = `${callbackUrls.thankYouPageUrl}${separator}checkout_id={CHECKOUT_SESSION_ID}`;

    const sessionParams: Record<string, any> = {
      mode: 'payment',
      line_items: lineItems,
      success_url: successUrl,
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
        items: persistedItems,
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