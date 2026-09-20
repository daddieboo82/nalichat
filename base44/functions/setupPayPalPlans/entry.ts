import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { secrets } from 'base44:runtime';

const PLANS = [
  { sku: 'premium_monthly', name: 'NaliChat Premium Monthly', interval_unit: 'MONTH', interval_count: 1, value: '7.99' },
  { sku: 'premium_yearly', name: 'NaliChat Premium Yearly', interval_unit: 'YEAR', interval_count: 1, value: '59.99' },
  { sku: 'premium_plus_monthly', name: 'NaliChat Premium Plus Monthly', interval_unit: 'MONTH', interval_count: 1, value: '14.99' },
  { sku: 'premium_plus_yearly', name: 'NaliChat Premium Plus Yearly', interval_unit: 'YEAR', interval_count: 1, value: '99.99' },
];

function apiBase() {
  return (secrets.get('PAYPAL_ENVIRONMENT') || 'live').toLowerCase() === 'sandbox'
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';
}

async function token() {
  const id = secrets.get('PAYPAL_CLIENT_ID');
  const secret = secrets.get('PAYPAL_CLIENT_SECRET');
  if (!id || !secret) throw new Error('PayPal credentials are not configured');
  const response = await fetch(apiBase() + '/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(id + ':' + secret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error('PayPal authentication failed');
  return data.access_token as string;
}

async function paypal(path: string, accessToken: string, body: unknown) {
  const response = await fetch(apiBase() + path, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error('PayPal setup request failed: ' + JSON.stringify(data).slice(0, 800));
  return data;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin required' }, { status: 403 });
    const existingPlanIds = Object.fromEntries(PLANS.map((p) => [p.sku, secrets.get('PAYPAL_' + p.sku.toUpperCase() + '_PLAN_ID')]).filter(([, id]) => Boolean(id)));
    if (Object.keys(existingPlanIds).length === PLANS.length) {
      return Response.json({ success: true, reused: true, plans: existingPlanIds });
    }
    const accessToken = await token();
    const product = await paypal('/v1/catalogs/products', accessToken, {
      name: 'NaliChat Membership',
      description: 'NaliChat Premium and Premium Plus memberships',
      type: 'SERVICE',
      category: 'SOFTWARE',
    });
    const plans: Record<string, string> = {};
    for (const p of PLANS) {
      const existing = existingPlanIds[p.sku];
      if (existing) { plans[p.sku] = existing; continue; }
      const plan = await paypal('/v1/billing/plans', accessToken, {
        product_id: product.id,
        name: p.name,
        description: p.name,
        status: 'ACTIVE',
        billing_cycles: [{
          frequency: { interval_unit: p.interval_unit, interval_count: p.interval_count },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: { fixed_price: { value: p.value, currency_code: 'USD' } },
        }],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee: { value: '0', currency_code: 'USD' },
          setup_fee_failure_action: 'CONTINUE',
          payment_failure_threshold: 3,
        },
      });
      plans[p.sku] = plan.id;
    }
    return Response.json({ success: true, productId: product.id, plans });
  } catch (error) {
    console.error('PayPal plan setup failed', error);
    return Response.json({ error: error instanceof Error ? error.message : 'PayPal setup failed' }, { status: 500 });
  }
});