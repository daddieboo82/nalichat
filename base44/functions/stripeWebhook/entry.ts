import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { verifyStripeSignature } from '../../shared/stripe.ts';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const rawBody = await req.text();
    if (!rawBody) {
      return Response.json({ error: 'Empty request body' }, { status: 400 });
    }

    const signatureHeader = req.headers.get('Stripe-Signature') || '';
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    if (!webhookSecret) {
      console.error('Missing STRIPE_WEBHOOK_SECRET');
      return Response.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    let event;
    try {
      event = await verifyStripeSignature(rawBody, signatureHeader, webhookSecret);
    } catch (err) {
      console.error('Stripe signature verification failed:', err);
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const base44 = createClientFromRequest(req);
    console.log('Stripe webhook received:', event.type);

    // ── checkout.session.completed — payment or subscription started ──
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const sessionId = session.id;

      // One-time purchase
      if (session.mode === 'payment') {
        try {
          const purchases = await base44.asServiceRole.entities.Base44Purchase.filter({
            checkoutSessionId: sessionId,
          });
          if (purchases.length > 0) {
            const purchase = purchases[0];
            // Idempotency — Stripe may redeliver
            if (purchase.status !== 'paid') {
              await base44.asServiceRole.entities.Base44Purchase.update(purchase.id, {
                status: 'paid',
                stripe_payment_intent_id: session.payment_intent || null,
                stripe_customer_id: session.customer || null,
                paid_at: new Date().toISOString(),
              });
              console.log('Purchase marked paid:', sessionId);
            }
          } else {
            console.warn('No Base44Purchase found for session:', sessionId);
          }
        } catch (e) {
          console.error('Failed to process Base44Purchase:', e);
        }
      }

      // Subscription
      if (session.mode === 'subscription' && session.subscription) {
        try {
          const subs = await base44.asServiceRole.entities.Subscription.filter({
            checkout_id: sessionId,
          });
          if (subs.length > 0) {
            const sub = subs[0];
            if (sub.status !== 'active') {
              await base44.asServiceRole.entities.Subscription.update(sub.id, {
                status: 'active',
                subscription_id: session.subscription,
              });
              console.log('Subscription activated:', session.subscription);
            }
          } else {
            console.warn('No Subscription found for checkout session:', sessionId);
          }
        } catch (e) {
          console.error('Failed to activate subscription:', e);
        }
      }

      return Response.json({ received: true });
    }

    // ── customer.subscription.updated ──
    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object;
      try {
        const subs = await base44.asServiceRole.entities.Subscription.filter({
          subscription_id: subscription.id,
        });
        if (subs.length > 0) {
          const statusMap: Record<string, string> = {
            active: 'active',
            past_due: 'active',
            canceled: 'canceled',
            unpaid: 'ended',
            incomplete: 'pending',
            incomplete_expired: 'ended',
          };
          const newStatus = statusMap[subscription.status] || 'active';
          await base44.asServiceRole.entities.Subscription.update(subs[0].id, {
            status: newStatus,
            current_period_end: subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000).toISOString()
              : undefined,
          });
          console.log('Subscription updated:', subscription.id, '->', newStatus);
        }
      } catch (e) {
        console.error('Failed to update subscription:', e);
      }
      return Response.json({ received: true });
    }

    // ── customer.subscription.deleted ──
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      try {
        const subs = await base44.asServiceRole.entities.Subscription.filter({
          subscription_id: subscription.id,
        });
        if (subs.length > 0) {
          await base44.asServiceRole.entities.Subscription.update(subs[0].id, {
            status: 'ended',
          });
          console.log('Subscription ended:', subscription.id);
        }
      } catch (e) {
        console.error('Failed to end subscription:', e);
      }
      return Response.json({ received: true });
    }

    // ── invoice.paid — recurring subscription payment succeeded ──
    if (event.type === 'invoice.paid') {
      const invoice = event.data.object;
      if (invoice.subscription) {
        try {
          const subs = await base44.asServiceRole.entities.Subscription.filter({
            subscription_id: invoice.subscription,
          });
          if (subs.length > 0) {
            const periodEnd = invoice.lines?.data?.[0]?.period?.end;
            await base44.asServiceRole.entities.Subscription.update(subs[0].id, {
              status: 'active',
              current_period_end: periodEnd
                ? new Date(periodEnd * 1000).toISOString()
                : undefined,
            });
          }
        } catch (e) {
          console.error('Failed to update subscription from invoice:', e);
        }
      }
      return Response.json({ received: true });
    }

    // ── invoice.payment_failed ──
    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object;
      if (invoice.subscription) {
        try {
          const subs = await base44.asServiceRole.entities.Subscription.filter({
            subscription_id: invoice.subscription,
          });
          if (subs.length > 0) {
            await base44.asServiceRole.entities.Subscription.update(subs[0].id, {
              status: 'canceled',
            });
            console.log('Subscription payment failed:', invoice.subscription);
          }
        } catch (e) {
          console.error('Failed to update subscription on payment failure:', e);
        }
      }
      return Response.json({ received: true });
    }

    // Unknown event type — ack receipt so Stripe doesn't retry
    console.log('Unhandled Stripe event type:', event.type);
    return Response.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});