import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { secrets } from 'base44:runtime';
import { APP_BASE_URL } from '../../shared/appConfig.ts';
import { paypalPeriodEndForStatus, resolvePayPalSubscriptionStatus } from '../../shared/paypalSubscription.ts';
import { hasPaidTierAccess, normalizePlan, normalizeStatus } from '../../shared/subscription.ts';

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

// Read every subscription page before deciding whether another recurring
// checkout is safe. Limiting this to the newest 100 can hide an older paid
// subscription and cause a second charge.
async function loadUserSubscriptions(entity: any, userId: string): Promise<any[]> {
  const rows: any[] = [];
  const pageSize = 200;
  for (let skip = 0; ; skip += pageSize) {
    const page = await entity.filter(
      { user_id: userId }, '-created_date', pageSize, skip,
    );
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Authentication required' }, { status: 401 });

    const body = await req.json();
    const sku = typeof body?.sku === 'string' ? body.sku : '';
    const idempotencyKey = typeof body?.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
    if (!/^[A-Za-z0-9._~-]{16,128}$/.test(idempotencyKey)) {
      return Response.json({ error: 'Invalid checkout request key' }, { status: 400 });
    }
    // PayPal-Request-Id has a fixed header limit. Check the *complete*
    // value, not just the browser-supplied key, before any provider request.
    // Keep the established ID format for existing retry compatibility.
    const providerRequestId = 'nalichat-' + user.id + '-' + idempotencyKey;
    if (providerRequestId.length > 108) {
      return Response.json({ error: 'Checkout request key is too long for this account' }, { status: 400 });
    }
    const item = CATALOG[sku];
    if (!item) return Response.json({ error: 'Unknown subscription plan' }, { status: 400 });
    const planId = secrets.get(item.secret);
    if (!planId) return Response.json({ error: 'PayPal plan is not configured yet', missingSecret: item.secret }, { status: 503 });

    // Block duplicate checkout if the user already has active paid access.
    const allSubs = await loadUserSubscriptions(
      base44.asServiceRole.entities.Subscription, user.id,
    );
    // A previously persisted browser request key must never switch plans.
    // A new plan requires a fresh request key to avoid PayPal returning the
    // earlier agreement for a different body under the same idempotency ID.
    if (allSubs.some((sub: any) =>
      sub.provider === 'paypal' &&
      sub.checkout_request_key === idempotencyKey &&
      sub.sku !== sku
    )) {
      return Response.json({ error: 'Checkout request key was already used for another plan' }, { status: 409 });
    }
    const now = new Date().toISOString();
    const alreadyPaid = allSubs.some((sub: any) => {
      const plan = normalizePlan(sub.plan);
      const status = normalizeStatus(sub.status);
      return plan !== 'free' && hasPaidTierAccess(status, {
        currentPeriodEnd: typeof sub.current_period_end === 'string' ? sub.current_period_end : null,
        trialEndDate: typeof sub.trial_end_date === 'string' ? sub.trial_end_date : null,
        now,
      });
    });
    if (alreadyPaid) {
      return Response.json({ error: 'This account already has a paid subscription; use the billing portal' }, { status: 409 });
    }

    // An unresolved Stripe or Wix checkout may still be completed after a
    // PayPal agreement is created. Refuse another recurring agreement until
    // those attempts are reconciled, including records with missing URLs.
    // This is a snapshot safety check, not an atomic checkout reservation.
    const unresolvedOtherProvider = allSubs.some((sub: any) =>
      (sub.provider === 'stripe' || sub.provider === 'wix') &&
      normalizePlan(sub.plan) !== 'free' &&
      (normalizeStatus(sub.status) === 'pending' ||
        normalizeStatus(sub.status) === 'incomplete')
    );
    if (unresolvedOtherProvider) {
      return Response.json({
        error: 'An existing Stripe or Wix checkout requires verification before PayPal checkout',
      }, { status: 409 });
    }

    // An active PayPal subscription with a missing or expired local billing
    // period may have renewed remotely. Do not create a second subscription
    // simply because local entitlements cannot currently verify its renewal.
    // The authenticated status check can reconcile these records with PayPal.
    const unresolvedActivePayPal = allSubs.some((sub: any) => (
      sub.provider === 'paypal' &&
      normalizePlan(sub.plan) !== 'free' &&
      normalizeStatus(sub.status) === 'active' &&
      !hasPaidTierAccess('active', {
        currentPeriodEnd: typeof sub.current_period_end === 'string' ? sub.current_period_end : null,
        now,
      })
    ));
    const undatedActivePayPal = allSubs.some((sub: any) => (
      sub.provider === 'paypal' &&
      normalizePlan(sub.plan) !== 'free' &&
      normalizeStatus(sub.status) === 'active' &&
      (typeof sub.current_period_end !== 'string' || !Number.isFinite(Date.parse(sub.current_period_end)))
    ));
    if (unresolvedActivePayPal || undatedActivePayPal) {
      return Response.json({
        error: 'An existing PayPal subscription requires status verification before another checkout',
      }, { status: 409 });
    }

    const token = await accessToken();
    // Scan all previously loaded records, not just the newest 20 pending
    // checkouts. An older unresolved PayPal agreement may still be billable.
    const existing = allSubs.filter((sub: any) => (
      sub.provider === 'paypal' && sub.status === 'pending'
    ));
    for (const pending of existing) {
      // A different SKU or missing provider metadata is not proof that an
      // existing pending agreement is safe to ignore. Resolve it first.
      if (!pending.subscription_id || pending.sku !== sku ||
          pending.paypal_plan_id !== planId ||
          pending.paypal_environment !== (secrets.get('PAYPAL_ENVIRONMENT') || 'live').toLowerCase()) {
        return Response.json({
          error: 'Existing PayPal checkout requires verification before another subscription',
        }, { status: 409 });
      }
      const lookup = await fetch(apiBase() + '/v1/billing/subscriptions/' + encodeURIComponent(pending.subscription_id), {
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      });
      if (!lookup.ok) {
        // PayPal being unavailable must not turn a retry into a second
        // recurring agreement.
        return Response.json({
          error: 'Could not verify the previous PayPal checkout',
        }, { status: 503 });
      }
      const remote = await lookup.json();
      // Verification must precede resolvePayPalSubscriptionStatus: for an
      // APPROVED PayPal subscription that helper calls /activate (a provider
      // mutation). Never activate a subscription whose owner/plan differs.
      if (remote?.plan_id !== planId || remote?.custom_id !== user.id + ':' + sku) {
        return Response.json({
          error: 'PayPal subscription ownership or plan could not be verified',
        }, { status: 409 });
      }
      const remoteStatus = await resolvePayPalSubscriptionStatus(apiBase(), token, pending.subscription_id, remote);
      if (remoteStatus === 'ACTIVE') {
        const periodEnd = paypalPeriodEndForStatus('active', remote?.billing_info?.next_billing_time);
        if (typeof periodEnd !== 'string' || Date.parse(periodEnd) <= Date.now()) {
          return Response.json({ error: 'PayPal subscription is active but its billing period requires verification' }, { status: 409 });
        }
        await base44.asServiceRole.entities.Subscription.update(pending.id, {
          status: 'active',
          current_period_end: periodEnd,
        });
        return Response.json({ error: 'This account already has a paid subscription; use the billing portal' }, { status: 409 });
      }
      // A confirmed terminal subscription can be replaced. Anything else
      // remains unresolved and must not be silently duplicated.
      if (remoteStatus === 'CANCELLED' || remoteStatus === 'EXPIRED') continue;
      if (remoteStatus !== 'APPROVAL_PENDING') {
        return Response.json({
          error: 'Existing PayPal checkout requires verification before another subscription',
        }, { status: 409 });
      }
      const approval = (Array.isArray(remote.links) ? remote.links.find((link: any) => link.rel === 'approve')?.href : '') || pending.checkout_url;
      const expectedHost = pending.paypal_environment === 'sandbox' ? 'www.sandbox.paypal.com' : 'www.paypal.com';
      let approvalUrl: URL;
      try { approvalUrl = new URL(approval); } catch {
        return Response.json({ error: 'Existing PayPal approval URL is invalid' }, { status: 409 });
      }
      if (approvalUrl.protocol !== 'https:' || approvalUrl.hostname !== expectedHost) {
        return Response.json({ error: 'Existing PayPal approval URL is invalid' }, { status: 409 });
      }
      return Response.json({
        success: true, action: 'create_paypal_subscription', userId: user.id, sku,
        checkoutUrl: approval, subscriptionId: pending.subscription_id, resumed: true,
      });
    }
    // Always return buyers to the canonical site. The platform app URL can still
    // be the old Base44 host, and a session on nalichat.org cannot confirm a
    // payment that lands on a different origin.
    const successUrl = new URL('/ThankYou?subscription=1', APP_BASE_URL).toString();
    const cancelUrl = new URL('/pricing?checkout=paypal_canceled', APP_BASE_URL).toString();
    const res = await fetch(apiBase() + '/v1/billing/subscriptions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'PayPal-Request-Id': providerRequestId,
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
    if (typeof approval !== 'string' || typeof data.id !== 'string' || !data.id) {
      return Response.json({ error: 'PayPal did not return an approval URL' }, { status: 502 });
    }
    // Apply the same HTTPS/PayPal-host restriction used by resumed checkouts
    // before persisting the URL or redirecting a customer to it.
    const expectedApprovalHost = (secrets.get('PAYPAL_ENVIRONMENT') || 'live').toLowerCase() === 'sandbox'
      ? 'www.sandbox.paypal.com' : 'www.paypal.com';
    let newApprovalUrl: URL;
    try { newApprovalUrl = new URL(approval); } catch {
      return Response.json({ error: 'PayPal returned an invalid approval URL' }, { status: 502 });
    }
    if (newApprovalUrl.protocol !== 'https:' || newApprovalUrl.hostname !== expectedApprovalHost) {
      return Response.json({ error: 'PayPal returned an invalid approval URL' }, { status: 502 });
    }

    await base44.asServiceRole.entities.Subscription.create({
      user_id: user.id,
      plan: item.plan,
      status: 'pending',
      provider: 'paypal',
      billing_period: item.billingPeriod,
      sku,
      checkout_request_key: idempotencyKey,
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