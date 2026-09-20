import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { secrets } from 'base44:runtime';
import { APP_BASE_URL } from '../../shared/appConfig.ts';

const CATALOG: Record<string, { plan: string; billingPeriod: string; secret: string }> = {
  premium_monthly: { plan: 'premium', billingPeriod: 'monthly', secret: 'PAYPAL_PREMIUM_MONTHLY_PLAN_ID' },
  premium_yearly: { plan: 'premium', billingPeriod: 'annual', secret: 'PAYPAL_PREMIUM_YEARLY_PLAN_ID' },
  premium_plus_monthly: { plan: 'premium_plus', billingPeriod: 'monthly', secret: 'PAYPAL_PREMIUM_PLUS_MONTHLY_PLAN_ID' },
  premium_plus_yearly: { plan: 'premium_plus', billingPeriod: 'annual', secret: 'PAYPAL_PREMIUM_PLUS_YEARLY_PLAN_ID' },
};

function apiBase() {
  return (secrets.get('PAYPAL_ENVIRONMENT') || 'live').toLowerCase() === 'sandbox'
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';
}

async function accessToken() {
  const id = secrets.get('PAYPAL_CLIENT_ID');
  const secret = secrets.get('PAYPAL_CLIENT_SECRET');
  if (!id || !secret) throw new Error('PayPal credentials are not configured');
  const res = await fetch(apiBase() + '/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(id + ':' + secret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error('PayPal authentication failed');
  return data.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Authentication required' }, { status: 401 });

    const body = await req.json();
    const sku = typeof body?.sku === 'string' ? body.sku : '';
    const item = CATALOG[sku];
    if (!item) return Response.json({ error: 'Unknown subscription plan' }, { status: 400 });
    const planId = secrets.get(item.secret);
    if (!planId) return Response.json({ error: 'PayPal plan is not configured yet', missingSecret: item.secret }, { status: 503 });

    const token = await accessToken();
    const successUrl = new URL('/subscription_thank_you?subscription=1', APP_BASE_URL).toString();
    const cancelUrl = new URL('/pricing', APP_BASE_URL).toString();
    const res = await fetch(apiBase() + '/v1/billing/subscriptions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'PayPal-Request-Id': 'nalichat-' + user.id + '-' + crypto.randomUUID(),
      },
      body: JSON.stringify({
        plan_id: planId,
        custom_id: user.id + ':' + sku,
        application_context: {
          brand_name: 'NaliChat',
          user_action: 'SUBSCRIBE_NOW',
          return_url: successUrl,
          cancel_url: cancelUrl,
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('PayPal subscription creation failed', data);
      return Response.json({ error: 'Unable to create PayPal checkout' }, { status: 502 });
    }
    const approval = Array.isArray(data.links) ? data.links.find((x: any) => x.rel === 'approve')?.href : '';
    if (!approval || !data.id) return Response.json({ error: 'PayPal did not return an approval URL' }, { status: 502 });

    await base44.asServiceRole.entities.Subscription.create({
      user_id: user.id,
      plan: item.plan,
      status: 'pending',
      provider: 'paypal',
      billing_period: item.billingPeriod,
      sku,
      subscription_id: data.id,
      paypal_plan_id: planId,
      paypal_environment: (secrets.get('PAYPAL_ENVIRONMENT') || 'live').toLowerCase(),
      checkout_url: approval,
    });

    return Response.json({
      success: true,
      action: 'create_paypal_subscription',
      userId: user.id,
      sku,
      checkoutUrl: approval,
      subscriptionId: data.id,
    });
  } catch (error) {
    console.error('PayPal checkout error', error);
    return Response.json({ error: 'Unable to create PayPal checkout' }, { status: 500 });
  }
});