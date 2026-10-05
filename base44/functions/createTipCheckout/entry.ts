import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { stripeRequest } from '../../shared/stripe.ts';
import { APP_ORIGIN } from '../../shared/appConfig.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';

const TIP_PRESETS = [5, 10, 25, 50];
const MAX_TIP_CENTS = 500_000;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Failed to create tip checkout session';
}

function isClientError(message: string): boolean {
  return message === 'Invalid checkout callback URL'
    || message === 'Checkout callback URL is not allowed';
}

function randomVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function anonymousCheckoutScope(req: Request): Promise<string> {
  const forwarded = String(
    req.headers.get('cf-connecting-ip')
    || req.headers.get('x-real-ip')
    || req.headers.get('x-forwarded-for')
    || '',
  ).split(',')[0].trim().slice(0, 128);
  const userAgent = String(req.headers.get('user-agent') || '').slice(0, 256);
  const source = `${forwarded || 'unknown'}:${userAgent || 'unknown'}`;
  return 'anon_tip_' + await sha256Hex(source);
}

function allowedCheckoutOrigins(): Set<string> {
  return new Set([APP_ORIGIN]);
}

function validateCallbackUrl(raw: unknown, allowedOrigins: Set<string>): string {
  if (typeof raw !== 'string' || !raw) throw new Error('Invalid checkout callback URL');
  const url = new URL(raw);
  if (url.protocol !== 'https:' || !allowedOrigins.has(url.origin)) {
    throw new Error('Checkout callback URL is not allowed');
  }
  return url.toString();
}


Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const body = await readJsonBodyLimited(req, 32 * 1024);
    const { creator_id, creator_name, amount, message, callbackUrls } = body;

    if (typeof creator_id !== 'string' || !creator_id) {
      return Response.json({ error: 'creator_id is required' }, { status: 400 });
    }
    if (typeof creator_name !== 'string' || !creator_name) {
      return Response.json({ error: 'creator_name is required' }, { status: 400 });
    }

    const tipAmount = Number(amount);
    if (!TIP_PRESETS.includes(tipAmount)) {
      return Response.json({ error: 'Invalid tip amount' }, { status: 400 });
    }

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

    const base44 = createClientFromRequest(req);
    let user;
    try {
      user = await base44.auth.me();
    } catch (_e) {
      // Tips can be anonymous
    }

    const checkoutScope = user?.id || await anonymousCheckoutScope(req);
    const checkoutRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      checkoutScope,
      'tip_checkout_create',
      20,
    );
    if (!checkoutRate.allowed) {
      return Response.json(
        { error: 'Too many tip attempts. Please try again later.' },
        { status: 429 },
      );
    }

    const unitAmountCents = Math.round(tipAmount * 100);
    if (unitAmountCents > MAX_TIP_CENTS) {
      return Response.json({ error: 'Tip amount exceeds the allowed limit' }, { status: 400 });
    }

    const purchaseVerifier = randomVerifier();
    const purchaseVerifierHash = await sha256Hex(purchaseVerifier);
    const successUrl = new URL(thankYouPageUrl);
    successUrl.searchParams.set('checkout_id', '{CHECKOUT_SESSION_ID}');
    successUrl.searchParams.set('purchase_token', purchaseVerifier);

    const sessionParams: Record<string, any> = {
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: unitAmountCents,
          product_data: { name: `Tip to ${creator_name}` },
        },
        quantity: 1,
      }],
      success_url: successUrl.toString(),
      cancel_url: postFlowUrl,
    };

    if (user?.email) {
      sessionParams.customer_email = user.email;
    }

    const session = await stripeRequest('/checkout/sessions', sessionParams);

    try {
      await base44.asServiceRole.entities.Base44Purchase.create({
        checkoutSessionId: session.id,
        status: 'pending',
        user_id: user?.id || null,
        user_email: user?.email || null,
        items: [{
          type: 'tip',
          creator_id,
          creator_name,
          amount: tipAmount.toFixed(2),
          quantity: 1,
        }],
        purchase_verifier_hash: purchaseVerifierHash,
      });
    } catch (error) {
      console.error('Failed to persist Base44Purchase for tip:', error);
      try {
        await stripeRequest(`/checkout/sessions/${encodeURIComponent(session.id)}/expire`, {}, 'POST');
      } catch (expireError) {
        console.error('Failed to expire orphaned checkout session:', expireError);
      }
      throw new Error('Unable to initialize tip record');
    }

    try {
      await base44.asServiceRole.entities.Tip.create({
        tipper_id: user?.id || null,
        tipper_name: user?.display_name || user?.full_name || null,
        creator_id,
        creator_name,
        amount: tipAmount,
        message: typeof message === 'string' ? message.slice(0, 500) : null,
        status: 'pending',
        checkout_session_id: session.id,
      });
    } catch (error) {
      console.error('Failed to create Tip record:', error);
    }

    return Response.json({
      checkoutUrl: session.url,
      checkoutId: session.id,
    });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    const message = errorMessage(error);
    console.error('Tip checkout error:', error);
    return Response.json(
      { error: isClientError(message) ? message : 'Unable to create tip checkout session' },
      { status: isClientError(message) ? 400 : 500 }
    );
  }
});