import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { secrets } from 'base44:runtime';
import { stripeEnvironmentFromSecretKey } from '../../shared/stripeBilling.ts';

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

    let environment = 'unconfigured';
    let configured = false;
    try {
      environment = stripeEnvironmentFromSecretKey(secrets.get('STRIPE_SECRET_KEY'));
      configured = true;
    } catch {}

    const requiredPriceSecrets = [
      'STRIPE_PRICE_PREMIUM_MONTHLY',
      'STRIPE_PRICE_PREMIUM_YEARLY',
      'STRIPE_PRICE_PREMIUM_PLUS_MONTHLY',
      'STRIPE_PRICE_PREMIUM_PLUS_YEARLY',
    ];
    const missingPriceSecrets = requiredPriceSecrets.filter((name) => {
      const value = secrets.get(name);
      return typeof value !== 'string' || !/^price_[A-Za-z0-9_]+$/.test(value.trim());
    });

    return Response.json({
      success: true,
      action: 'billing_test_status',
      adminUserId: user.id,
      configured,
      environment,
      testMode: environment === 'test',
      priceCatalogReady: missingPriceSecrets.length === 0,
      missingPriceSecrets,
    });
  } catch (error) {
    console.error('getBillingTestStatus error:', error);
    return Response.json({ error: 'Unable to inspect billing test status' }, { status: 500 });
  }
});
