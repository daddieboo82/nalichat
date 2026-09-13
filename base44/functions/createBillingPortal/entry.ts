import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { resolvePortalReturnUrl } from '../../shared/stripeBilling.ts';
import { stripeRequest } from '../../shared/stripe.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { APP_BASE_URL } from '../../shared/appConfig.ts';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';

async function loadStripeSubscriptions(entity: any, userId: string) {
  const rows: any[] = [];
  const pageSize = 200;
  for (let skip = 0; ; skip += pageSize) {
    const page = await entity.filter(
      { user_id: userId, provider: 'stripe' },
      '-created_date',
      pageSize,
      skip,
    );
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const { returnDestination } = await readJsonBodyLimited(req, 8 * 1024);
    const returnUrl = resolvePortalReturnUrl(returnDestination, APP_BASE_URL);

    const base44 = createClientFromRequest(req);
    let user;
    try {
      user = await base44.auth.me();
    } catch {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!user?.id) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const portalRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'billing_portal',
      20,
    );
    if (!portalRate.allowed) {
      return Response.json(
        { error: 'Too many billing portal requests. Please try again later.' },
        { status: 429 },
      );
    }

    const subscriptions = await loadStripeSubscriptions(
      base44.asServiceRole.entities.Subscription,
      user.id,
    );
    const associatedCustomerIds = new Set(
      subscriptions
        .map((subscription: Record<string, unknown>) => subscription.stripe_customer_id)
        .filter((value: unknown): value is string => typeof value === 'string' && value.length > 0),
    );
    const customerId = typeof user.stripe_customer_id === 'string'
      ? user.stripe_customer_id
      : associatedCustomerIds.values().next().value;
    if (!customerId || (
      user.stripe_customer_id !== customerId
      && !associatedCustomerIds.has(customerId)
    )) {
      return Response.json({ error: 'No Stripe customer belongs to this account' }, { status: 404 });
    }

    const customer = await stripeRequest(
      `/customers/${encodeURIComponent(customerId)}`,
      {},
      'GET',
    );
    const metadataOwner = customer?.metadata?.nali_user_id;
    const hasLocalOwnership = user.stripe_customer_id === customerId
      || associatedCustomerIds.has(customerId);
    if (
      customer?.deleted === true
      || (metadataOwner && metadataOwner !== user.id)
      || (!metadataOwner && !hasLocalOwnership)
    ) {
      return Response.json({ error: 'Stripe customer ownership check failed' }, { status: 403 });
    }

    const session = await stripeRequest('/billing_portal/sessions', {
      customer: customerId,
      return_url: returnUrl,
    });
    return Response.json({ success: true, portalUrl: session.url });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('Billing portal error:', error);
    const message = error instanceof Error ? error.message : '';
    const clientError = message.startsWith('Unknown billing portal');
    return Response.json(
      { error: clientError ? message : 'Unable to create billing portal session' },
      { status: clientError ? 400 : 500 },
    );
  }
});
