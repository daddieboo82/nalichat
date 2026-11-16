import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { secrets } from 'base44:runtime';

// Customer-triggered recovery only. Verify every pending agreement is terminal
// at PayPal before changing any local subscription. Never activate, cancel,
// create, or revise a provider agreement.
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id) return Response.json({ error: 'Authentication required' }, { status: 401 });
    const env = String(secrets.get('PAYPAL_ENVIRONMENT') || '').toLowerCase();
    if (env !== 'live' && env !== 'sandbox') return Response.json({ error: 'PayPal environment unavailable' }, { status: 503 });
    const subscriptions = base44.asServiceRole.entities.Subscription;
    const pending = await subscriptions.filter(
      { user_id: user.id, provider: 'paypal', status: 'pending' }, '-created_date', 26,
    );
    if (!Array.isArray(pending) || pending.length > 25) return Response.json({ error: 'Billing history requires support review' }, { status: 409 });
    if (!pending.length) return Response.json({ success: true, action: 'reconcile_terminal_paypal', userId: user.id, resolved: 0 });

    const clientId = secrets.get('PAYPAL_CLIENT_ID');
    const clientSecret = secrets.get('PAYPAL_CLIENT_SECRET');
    if (!clientId || !clientSecret || clientId.startsWith('REPLACE_') || clientSecret.startsWith('REPLACE_'))
      return Response.json({ error: 'PayPal verification unavailable' }, { status: 503 });
    const api = env === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
    const authentication = await fetch(api + '/v1/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(clientId + ':' + clientSecret),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const credentials = await authentication.json().catch(() => null);
    if (!authentication.ok || !credentials?.access_token)
      return Response.json({ error: 'PayPal authentication unavailable' }, { status: 503 });
    const headers = { Authorization: 'Bearer ' + credentials.access_token, Accept: 'application/json' };

    // Collect evidence for every agreement first. Unknown, ACTIVE, APPROVED,
    // SUSPENDED, or mismatched agreements prohibit the entire recovery.
    for (const row of pending) {
      if (!row?.id || !row.subscription_id || !row.paypal_plan_id || !row.sku || row.paypal_environment !== env)
        return Response.json({ error: 'Existing PayPal billing requires review' }, { status: 409 });
      const response = await fetch(api + '/v1/billing/subscriptions/' + encodeURIComponent(row.subscription_id), { headers });
      if (!response.ok) return Response.json({ error: 'Could not verify all PayPal agreements' }, { status: 503 });
      const remote = await response.json().catch(() => null);
      if (remote?.id !== row.subscription_id ||
          remote?.plan_id !== row.paypal_plan_id ||
          remote?.custom_id !== user.id + ':' + row.sku ||
          !['CANCELLED', 'EXPIRED'].includes(String(remote?.status || '').toUpperCase())) {
        return Response.json({ error: 'An earlier PayPal agreement still requires review' }, { status: 409 });
      }
    }
    // Check the entire pending set again before updating anything. A new
    // checkout may have been created during the provider checks, so a snapshot
    // of the original rows alone is not sufficient.
    const latest = await subscriptions.filter(
      { user_id: user.id, provider: 'paypal', status: 'pending' }, '-created_date', 26,
    );
    const originalIds = new Set(pending.map((row: any) => row.id));
    if (!Array.isArray(latest) || latest.length !== pending.length ||
        latest.some((row: any) => !originalIds.has(row.id))) {
      return Response.json({
        error: 'Subscription history changed during review; refresh billing status',
      }, { status: 409 });
    }

    // Validate ALL local records before making the first write. This avoids
    // predictable partial updates when a webhook has already changed a row.
    for (const row of pending) {
      const current = await subscriptions.get(row.id);
      if (!current || current.user_id !== user.id ||
          current.provider !== 'paypal' || current.status !== 'pending' ||
          current.subscription_id !== row.subscription_id ||
          current.paypal_plan_id !== row.paypal_plan_id ||
          current.sku !== row.sku || current.paypal_environment !== env) {
        return Response.json({
          error: 'Subscription changed during review; refresh billing status',
        }, { status: 409 });
      }
    }
    // This is not an atomic database transaction. Recheck each row as close
    // to its write as the SDK permits, so an independently reconciled ACTIVE
    // or otherwise changed agreement is not knowingly overwritten.
    for (const row of pending) {
      const current = await subscriptions.get(row.id);
      if (!current || current.user_id !== user.id ||
          current.provider !== 'paypal' || current.status !== 'pending' ||
          current.subscription_id !== row.subscription_id ||
          current.paypal_plan_id !== row.paypal_plan_id ||
          current.sku !== row.sku || current.paypal_environment !== env) {
        return Response.json({
          error: 'Subscription changed during recovery; refresh billing status',
        }, { status: 409 });
      }
      await subscriptions.update(row.id, { status: 'canceled', cancel_at_period_end: false });
    }
    return Response.json({
      success: true, action: 'reconcile_terminal_paypal', userId: user.id, resolved: pending.length,
    });
  } catch (error) {
    console.error('Terminal PayPal reconciliation unavailable', error);
    return Response.json({ error: 'Could not complete PayPal billing review' }, { status: 503 });
  }
});
