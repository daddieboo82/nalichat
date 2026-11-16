import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { secrets } from 'base44:runtime';

// Read-only pending agreement review for the authenticated customer.
// No activation, cancellation, entity mutation, or new checkout creation.
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id) return Response.json({ error: 'Authentication required' }, { status: 401 });
    const env = String(secrets.get('PAYPAL_ENVIRONMENT') || '').toLowerCase();
    if (env !== 'live' && env !== 'sandbox')
      return Response.json({ error: 'PayPal environment is unavailable' }, { status: 503 });
    const rows = await base44.asServiceRole.entities.Subscription.filter(
      { user_id: user.id, provider: 'paypal', status: 'pending' }, '-created_date', 26,
    );
    if (rows.length > 25) return Response.json({ error: 'Billing history requires support review' }, { status: 409 });
    if (!rows.length) return Response.json({
      success: true, action: 'get_my_pending_paypal_status', userId: user.id, total: 0, results: [],
    });
    const clientId = secrets.get('PAYPAL_CLIENT_ID');
    const secret = secrets.get('PAYPAL_CLIENT_SECRET');
    if (!clientId || !secret) return Response.json({ error: 'PayPal verification unavailable' }, { status: 503 });
    const api = env === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
    const auth = await fetch(api + '/v1/oauth2/token', {
      method: 'POST',
      headers: { Authorization: 'Basic ' + btoa(clientId + ':' + secret), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    const token = await auth.json().catch(() => null);
    if (!auth.ok || !token?.access_token)
      return Response.json({ error: 'PayPal verification unavailable' }, { status: 503 });
    const results = [];
    for (const row of rows) {
      let status = 'review_required';
      try {
        if (row.subscription_id && row.paypal_plan_id && row.sku && row.paypal_environment === env) {
          const response = await fetch(api + '/v1/billing/subscriptions/' + encodeURIComponent(row.subscription_id), {
            headers: { Authorization: 'Bearer ' + token.access_token, Accept: 'application/json' },
          });
          if (response.ok) {
            const remote = await response.json();
            if (remote?.id === row.subscription_id && remote?.plan_id === row.paypal_plan_id &&
                remote?.custom_id === user.id + ':' + row.sku) {
              const state = String(remote.status || '').toUpperCase();
              if (['APPROVAL_PENDING', 'APPROVED', 'ACTIVE', 'CANCELLED', 'EXPIRED', 'SUSPENDED'].includes(state))
                status = state.toLowerCase();
            }
          }
        }
      } catch {
        // Unknown provider result is never interpreted as a canceled agreement.
      }
      results.push({ status });
    }
    return Response.json({ success: true, action: 'get_my_pending_paypal_status',
      userId: user.id, total: rows.length, results,
      note: 'This is a read-only status check, not confirmation that a payment was collected.' });
  } catch {
    return Response.json({ error: 'Unable to review earlier PayPal agreements' }, { status: 503 });
  }
});
