import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { stripeRequest } from '../../shared/stripe.ts';

// Server-side price catalog — never trust client-supplied prices
const DONATION_PRESETS = [5, 10, 25, 50];
const EXPORT_PRICES: Record<string, number> = { wav: 1.99, mp3: 0.99 };
const BONUS_MULTIPLIER = 1.5;

function getWeekKey(date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
}

async function isSquadBonusActive(base44: any, userId: string): Promise<boolean> {
  try {
    const [asA, asB] = await Promise.all([
      base44.asServiceRole.entities.Squad.filter({ member_a_id: userId, status: 'active' }),
      base44.asServiceRole.entities.Squad.filter({ member_b_id: userId, status: 'active' }),
    ]);
    const squad = asA[0] || asB[0];
    if (!squad) return false;

    const weekKey = getWeekKey();
    const progress = await base44.asServiceRole.entities.SquadProgress.filter({
      squad_id: squad.id,
      week_key: weekKey,
    });
    const p = progress[0];
    if (!p?.bonus_unlocked) return false;

    const now = new Date();
    return !!(
      p.bonus_starts_at &&
      p.bonus_expires_at &&
      now >= new Date(p.bonus_starts_at) &&
      now <= new Date(p.bonus_expires_at)
    );
  } catch {
    return false;
  }
}

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
        // Entity-backed item (ArtPost or SharedFile) — look up price from DB
        let record;
        try {
          record = await base44.asServiceRole.entities.ArtPost.get(item.id);
        } catch (_e) {
          // Not an ArtPost, try SharedFile
        }
        if (!record) {
          try {
            record = await base44.asServiceRole.entities.SharedFile.get(item.id);
          } catch (_e) {
            // Not found in either entity
          }
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
      } else if (item.type === 'studio_export') {
        // Studio export — use fixed server-side price table
        const format = String(item.format).toLowerCase();
        if (!(format in EXPORT_PRICES)) {
          return Response.json(
            { error: 'Invalid export format' },
            { status: 400 }
          );
        }
        const basePrice = EXPORT_PRICES[format];
        // Check squad bonus server-side instead of trusting client
        const bonusActive = user?.id
          ? await isSquadBonusActive(base44, user.id)
          : false;
        unitPrice = bonusActive
          ? Math.round((basePrice / BONUS_MULTIPLIER) * 100) / 100
          : basePrice;
        name = `Studio Export - ${format.toUpperCase()} Download`;
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
        ...(item.id ? { id: item.id } : {}),
        ...(item.type ? { type: item.type } : {}),
      });
    }

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