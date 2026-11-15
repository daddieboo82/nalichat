import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { secrets } from 'base44:runtime';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Authentication required' }, { status: 401 });
    const rows = await base44.asServiceRole.entities.Subscription.filter({ user_id: user.id, provider: 'paypal', status: 'active' }, '-created_date', 3);
    if (rows.length !== 1) return Response.json({ error: 'An active PayPal subscription must be reviewed before verification' }, { status: 409 });
    const row = rows[0];
    if (!row.subscription_id || !row.paypal_plan_id || !row.sku || row.paypal_environment !== 'live')
      return Response.json({ error: 'Subscription details require review' }, { status: 409 });
    const id = secrets.get('PAYPAL_CLIENT_ID'), secret = secrets.get('PAYPAL_CLIENT_SECRET');
    if (!id || !secret || (secrets.get('PAYPAL_ENVIRONMENT') || 'live').toLowerCase() !== 'live')
      return Response.json({ error: 'Live PayPal verification unavailable' }, { status: 503 });
    const auth = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: { Authorization: 'Basic ' + btoa(id + ':' + secret), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    const token = await auth.json().catch(() => ({}));
    if (!auth.ok || !token.access_token) return Response.json({ error: 'PayPal authentication unavailable' }, { status: 503 });
    const response = await fetch('https://api-m.paypal.com/v1/billing/subscriptions/' + encodeURIComponent(row.subscription_id), {
      headers: { Authorization: 'Bearer ' + token.access_token, Accept: 'application/json' },
    });
    const remote = await response.json().catch(() => ({}));
    if (!response.ok || remote.id !== row.subscription_id ||
        remote.custom_id !== user.id + ':' + row.sku || remote.status !== 'ACTIVE')
      return Response.json({ error: 'PayPal has not confirmed the subscription upgrade yet' }, { status: 409 });
    const monthly = secrets.get('PAYPAL_PREMIUM_PLUS_MONTHLY_PLAN_ID');
    const yearly = secrets.get('PAYPAL_PREMIUM_PLUS_YEARLY_PLAN_ID');
    if (!monthly || !yearly) return Response.json({ error: 'Upgrade plan configuration unavailable' }, { status: 503 });
    if (remote.plan_id === row.paypal_plan_id && row.plan === 'premium_plus')
      return Response.json({ success: true, action: 'verify_paypal_upgrade', userId: user.id, upgraded: true });
    if (row.plan !== 'premium' || (remote.plan_id !== monthly && remote.plan_id !== yearly))
      return Response.json({ error: 'PayPal has not confirmed a Premium Plus plan change' }, { status: 409 });
    await base44.asServiceRole.entities.Subscription.update(row.id, {
      plan: 'premium_plus',
      billing_period: remote.plan_id === yearly ? 'annual' : 'monthly',
      paypal_plan_id: remote.plan_id,
      status: 'active',
      current_period_end: remote.billing_info?.next_billing_time || row.current_period_end || null,
    });
    return Response.json({ success: true, action: 'verify_paypal_upgrade', userId: user.id, upgraded: true });
  } catch (error) {
    console.error('PayPal upgrade verification error', error);
    return Response.json({ error: 'Unable to verify the upgrade with PayPal' }, { status: 503 });
  }
});
