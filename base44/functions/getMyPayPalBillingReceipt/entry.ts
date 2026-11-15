import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { secrets } from 'base44:runtime';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const sdk = createClientFromRequest(req);
    const user = await sdk.auth.me();
    if (!user?.id) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if ((secrets.get('PAYPAL_ENVIRONMENT') || 'live').toLowerCase() !== 'live')
      return Response.json({ error: 'Live PayPal reporting unavailable' }, { status: 503 });
    const rows = await sdk.asServiceRole.entities.Subscription.filter({ user_id: user.id, provider: 'paypal', status: 'active' }, '-created_date', 3);
    if (rows.length !== 1) return Response.json({ error: 'Billing history requires review' }, { status: 409 });
    const row = rows[0];
    if (!row.subscription_id || !row.paypal_plan_id || !row.sku || row.paypal_environment !== 'live')
      return Response.json({ error: 'PayPal agreement details unavailable' }, { status: 409 });
    const clientId = secrets.get('PAYPAL_CLIENT_ID'), secret = secrets.get('PAYPAL_CLIENT_SECRET');
    if (!clientId || !secret) return Response.json({ error: 'PayPal credentials unavailable' }, { status: 503 });
    const auth = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: { Authorization: 'Basic ' + btoa(clientId + ':' + secret), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    const token = await auth.json().catch(() => ({}));
    if (!auth.ok || !token.access_token) return Response.json({ error: 'PayPal authentication unavailable' }, { status: 503 });
    const response = await fetch('https://api-m.paypal.com/v1/billing/subscriptions/' + encodeURIComponent(row.subscription_id), {
      headers: { Authorization: 'Bearer ' + token.access_token, Accept: 'application/json' },
    });
    const remote = await response.json().catch(() => ({}));
    if (!response.ok || remote.id !== row.subscription_id || remote.custom_id !== user.id + ':' + row.sku)
      return Response.json({ error: 'Could not verify ownership of the PayPal agreement' }, { status: 409 });
    const last = remote.billing_info?.last_payment;
    return Response.json({
      success: true, action: 'paypal_billing_receipt', userId: user.id,
      providerStatus: remote.status || 'UNKNOWN',
      providerPlanMatchesLocal: remote.plan_id === row.paypal_plan_id,
      lastPayment: last?.time && last?.amount?.value ? {
        time: last.time, amount: last.amount.value, currency: last.amount.currency_code || 'UNKNOWN',
      } : null,
      nextBillingTime: remote.billing_info?.next_billing_time || null,
      outstandingBalance: remote.billing_info?.outstanding_balance?.value || null,
      note: 'Last payment is historical. It does not prove a charge occurred at the moment of upgrade.',
    });
  } catch (error) {
    console.error('PayPal billing receipt lookup failed', error);
    return Response.json({ error: 'PayPal billing information temporarily unavailable' }, { status: 503 });
  }
});
