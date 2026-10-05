import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { APP_BASE_URL } from '../../shared/appConfig.ts';
import { hasPaidTierAccess, normalizePlan, normalizeStatus } from '../../shared/subscription.ts';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

const CATALOG: Record<string, { plan: string; billingPeriod: string; price: string; frequency: 'MONTH' | 'YEAR'; name: string; description: string }> = {
  premium_monthly: { plan: 'premium', billingPeriod: 'monthly', price: '7.99', frequency: 'MONTH', name: 'NaliChat Premium Monthly', description: 'Premium monthly subscription with NALI.ai, larger transfers, and advanced messaging.' },
  premium_yearly: { plan: 'premium', billingPeriod: 'annual', price: '59.99', frequency: 'YEAR', name: 'NaliChat Premium Yearly', description: 'Premium yearly subscription with NALI.ai, larger transfers, and advanced messaging.' },
  premium_plus_monthly: { plan: 'premium_plus', billingPeriod: 'monthly', price: '14.99', frequency: 'MONTH', name: 'NaliChat Premium Plus Monthly', description: 'Premium Plus monthly subscription with the highest AI limits and strongest Studio support.' },
  premium_plus_yearly: { plan: 'premium_plus', billingPeriod: 'annual', price: '99.99', frequency: 'YEAR', name: 'NaliChat Premium Plus Yearly', description: 'Premium Plus yearly subscription with the highest AI limits and strongest Studio support.' },
};

function resolveAppUrl(req: Request): string {
  const headerAppUrl = req.headers.get('X-Base44-App-Url');
  if (headerAppUrl) {
    try {
      const parsed = new URL(headerAppUrl);
      if (parsed.protocol === 'https:' && !parsed.username && !parsed.password && parsed.pathname === '/' && !parsed.search && !parsed.hash) {
        return parsed.origin;
      }
    } catch {
      // Invalid header — fall back to APP_BASE_URL
    }
  }
  return APP_BASE_URL;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = await readJsonBodyLimited(req, 16 * 1024);
    const sku = typeof body?.sku === 'string' ? body.sku : '';
    const idempotencyKey = typeof body?.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
    if (!/^[A-Za-z0-9._~-]{16,128}$/.test(idempotencyKey)) {
      return Response.json({ error: 'Invalid checkout request key' }, { status: 400 });
    }
    const item = CATALOG[sku];
    if (!item) {
      return Response.json({ error: 'Unknown subscription plan' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);
    let user;
    try {
      user = await base44.auth.me();
    } catch {
      return Response.json({ error: 'Authentication required for subscriptions' }, { status: 401 });
    }
    if (!user?.id) {
      return Response.json({ error: 'Authentication required for subscriptions' }, { status: 401 });
    }

    const checkoutRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'wix_checkout',
      12,
    );
    if (!checkoutRate.allowed) {
      return Response.json(
        { error: 'Too many checkout attempts. Please try again later.' },
        { status: 429 },
      );
    }

    // Block duplicate checkout if the user already has active paid access
    const allSubs = await base44.asServiceRole.entities.Subscription.filter(
      { user_id: user.id }, '-created_date', 100,
    );
    const now = new Date().toISOString();
    const alreadyPaid = allSubs.some((sub: any) => {
      const plan = normalizePlan(sub.plan);
      const status = normalizeStatus(sub.status);
      return plan !== 'free' && hasPaidTierAccess(status, {
        currentPeriodEnd: typeof sub.current_period_end === 'string' ? sub.current_period_end : null,
        trialEndDate: typeof sub.trial_end_date === 'string' ? sub.trial_end_date : null,
        now,
      });
    });
    if (alreadyPaid) {
      return Response.json({ error: 'This account already has a paid subscription; use the billing portal' }, { status: 409 });
    }

    // Reuse any still-pending Wix checkout for this SKU
    const reusable = allSubs.find((sub: any) =>
      sub.provider === 'wix' &&
      sub.sku === sku &&
      sub.status === 'pending' &&
      typeof sub.checkout_url === 'string' &&
      sub.checkout_url &&
      typeof sub.checkout_id === 'string' &&
      sub.checkout_id
    );
    if (reusable) {
      return Response.json({
        success: true,
        action: 'create_checkout',
        userId: user.id,
        sku,
        redirectUrl: reusable.checkout_url,
        checkoutId: reusable.checkout_id,
        reused: true,
      });
    }

    // Resolve return URLs from the X-Base44-App-Url header, falling back to APP_BASE_URL
    const appBaseUrl = resolveAppUrl(req);
    const successUrl = new URL('/ThankYou?subscription=1', appBaseUrl).toString();
    const cancelUrl = new URL('/pricing', appBaseUrl).toString();

    // Create Wix checkout session
    const wixApiKey = secrets.get('WIX_PAYMENTS_API_KEY') || secrets.get('WIX_CHECKOUT_API_KEY');
    const wixSiteId = secrets.get('WIX_PAYMENTS_SITE_ID') || secrets.get('WIX_CHECKOUT_SITE_ID');
    if (!wixApiKey || !wixSiteId) {
      console.error('Missing Wix Payments credentials');
      return Response.json({ error: 'Payment provider is not configured' }, { status: 500 });
    }

    const checkoutResponse = await fetch(
      'https://www.wixapis.com/payments/platform/v1/checkout-sessions/construct',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': wixApiKey,
          'wix-site-id': wixSiteId,
        },
        body: JSON.stringify({
          cart: {
            items: [{
              name: item.name,
              quantity: 1,
              price: item.price,
              subscriptionInfo: {
                subscriptionSettings: {
                  frequency: item.frequency,
                },
                title: item.name,
                description: item.description,
              },
            }],
            customerInfo: user.email ? { email: user.email } : undefined,
          },
          callbackUrls: {
            postFlowUrl: cancelUrl,
            thankYouPageUrl: successUrl,
          },
        }),
      }
    );

    if (!checkoutResponse.ok) {
      const errorData = await checkoutResponse.json().catch(() => ({}));
      console.error('Wix checkout creation failed', checkoutResponse.status, JSON.stringify(errorData));
      return Response.json({ error: 'Unable to create checkout' }, { status: 502 });
    }

    const checkoutData = await checkoutResponse.json();
    const checkoutSession = checkoutData?.checkoutSession;
    if (!checkoutSession?.id || !checkoutSession?.redirectUrl) {
      console.error('Wix checkout missing session data', JSON.stringify(checkoutData));
      return Response.json({ error: 'Unable to create checkout' }, { status: 502 });
    }

    // Persist Base44Purchase record
    try {
      await base44.asServiceRole.entities.Base44Purchase.create({
        checkoutSessionId: checkoutSession.id,
        status: 'pending',
        user_id: user.id,
        user_email: user.email || null,
        items: [{ type: 'subscription', sku, plan: item.plan, billingPeriod: item.billingPeriod }],
      });
    } catch (error) {
      console.error('Failed to persist Base44Purchase for Wix checkout:', error);
      throw new Error('Unable to initialize checkout record');
    }

    // Create Subscription record
    try {
      await base44.asServiceRole.entities.Subscription.create({
        user_id: user.id,
        plan: item.plan,
        status: 'pending',
        provider: 'wix',
        billing_period: item.billingPeriod,
        sku,
        checkout_id: checkoutSession.id,
        checkout_url: checkoutSession.redirectUrl,
        checkout_request_key: idempotencyKey,
      });
    } catch (error) {
      console.error('Failed to create Subscription record for Wix checkout:', error);
    }

    return Response.json({
      success: true,
      action: 'create_checkout',
      userId: user.id,
      sku,
      redirectUrl: checkoutSession.redirectUrl,
      checkoutId: checkoutSession.id,
      reused: false,
    });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('Wix checkout error:', error);
    return Response.json({ error: 'Unable to create checkout' }, { status: 500 });
  }
});