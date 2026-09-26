import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { secrets } from 'base44:runtime';


Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin role required' }, { status: 403 });
    }
    if (user.is_banned) {
      return Response.json({ error: 'banned' }, { status: 403 });
    }
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const environment = (secrets.get('PAYPAL_ENVIRONMENT') || 'live').trim().toLowerCase();
    const requiredSecrets = [
      'PAYPAL_CLIENT_ID',
      'PAYPAL_CLIENT_SECRET',
      'PAYPAL_PREMIUM_MONTHLY_PLAN_ID',
      'PAYPAL_PREMIUM_YEARLY_PLAN_ID',
      'PAYPAL_PREMIUM_PLUS_MONTHLY_PLAN_ID',
      'PAYPAL_PREMIUM_PLUS_YEARLY_PLAN_ID',
    ];
    const missingSecrets = requiredSecrets.filter((name) => {
      const value = secrets.get(name);
      return typeof value !== 'string' || !value.trim();
    });
    const sandboxMode = environment === 'sandbox';
    const webhookConfigured = Boolean(String(secrets.get('PAYPAL_WEBHOOK_ID') || '').trim());

    return Response.json({
      success: true,
      action: 'billing_test_status',
      adminUserId: user.id,
      provider: 'paypal',
      configured: missingSecrets.length === 0,
      environment,
      testMode: sandboxMode,
      sandboxMode,
      priceCatalogReady: missingSecrets.length === 0,
      missingPriceSecrets: missingSecrets,
      missingSecrets,
      webhookConfigured,
    });
  } catch (error) {
    console.error('getBillingTestStatus error:', error);
    return Response.json({ error: 'Unable to inspect billing test status' }, { status: 500 });
  }
});
