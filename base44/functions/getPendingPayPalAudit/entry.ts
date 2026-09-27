import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { secrets } from 'base44:runtime';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

function apiBase(environment: string) {
  return environment === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id || user.role !== 'admin' || user.is_banned ||
        (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now())) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const limit = await consumeHourlyLimit(base44.asServiceRole.entities, user.id, 'pending_paypal_audit', 10);
    if (!limit.allowed) return Response.json({ error: 'Audit rate limit reached' }, { status: 429 });

    const environment = (secrets.get('PAYPAL_ENVIRONMENT') || 'live').trim().toLowerCase();
    const clientId = secrets.get('PAYPAL_CLIENT_ID');
    const clientSecret = secrets.get('PAYPAL_CLIENT_SECRET');
    if (!clientId || !clientSecret) return Response.json({ error: 'PayPal is not configured' }, { status: 503 });

    const auth = await fetch(apiBase(environment) + '/v1/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(clientId + ':' + clientSecret),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const credentials = await auth.json();
    if (!auth.ok || !credentials.access_token) return Response.json({ error: 'PayPal authentication failed' }, { status: 502 });

    const headers = { Authorization: 'Bearer ' + credentials.access_token, Accept: 'application/json' };
    const active = await base44.asServiceRole.entities.Subscription.filter(
      { provider: 'paypal', status: 'active' }, '-created_date', 30,
    );
    const reference = active.find((record) => record.subscription_id && record.paypal_environment === environment);
    let referenceCheck: { status: string; httpStatus?: number } = { status: 'unavailable' };
    if (reference) {
      try {
        const response = await fetch(apiBase(environment) + '/v1/billing/subscriptions/' + encodeURIComponent(reference.subscription_id), { headers });
        referenceCheck = response.ok
          ? { status: String((await response.json()).status || 'unknown').toUpperCase(), httpStatus: response.status }
          : { status: 'lookup_failed', httpStatus: response.status };
      } catch {
        referenceCheck = { status: 'request_failed' };
      }
    }
    const pending = await base44.asServiceRole.entities.Subscription.filter(
      { provider: 'paypal', status: 'pending' }, '-created_date', 100,
    );
    const results = [];
    for (const record of pending) {
      if (!record.subscription_id || record.paypal_environment !== environment) {
        results.push({ subscriptionId: record.subscription_id || null, plan: record.sku || record.plan, status: 'environment_mismatch' });
        continue;
      }
      try {
        const response = await fetch(
          apiBase(environment) + '/v1/billing/subscriptions/' + encodeURIComponent(record.subscription_id),
          { headers },
        );
        if (!response.ok) {
          results.push({ subscriptionId: record.subscription_id, plan: record.sku || record.plan, status: response.status === 404 ? 'not_found' : 'lookup_failed', httpStatus: response.status });
          continue;
        }
        const remote = await response.json();
        results.push({
          subscriptionId: record.subscription_id,
          plan: record.sku || record.plan,
          status: String(remote.status || 'unknown').toUpperCase(),
          paymentRecorded: Boolean(remote.billing_info?.last_payment?.time),
        });
      } catch {
        results.push({ subscriptionId: record.subscription_id, plan: record.sku || record.plan, status: 'lookup_failed' });
      }
    }
    return Response.json({ success: true, action: 'pending_paypal_audit', adminUserId: user.id,
      environment, referenceCheck, checked: results.length, results });
  } catch (error) {
    console.error('Pending PayPal audit failed', error);
    return Response.json({ error: 'Unable to audit pending PayPal subscriptions' }, { status: 500 });
  }
});
