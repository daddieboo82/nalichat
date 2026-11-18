import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { secrets } from 'base44:runtime';
import { APP_BASE_URL } from '../../shared/appConfig.ts';
import { paypalPeriodEndForStatus, resolvePayPalSubscriptionStatus } from '../../shared/paypalSubscription.ts';
import { hasLiveSubscription, normalizePlan, normalizeStatus } from '../../shared/subscription.ts';
import { paypalSubscriptionRequestId } from '../../shared/paypalCheckoutRequest.ts';

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
  if (!id || !secret || id.startsWith('REPLACE_') || secret.startsWith('REPLACE_')) {
    throw new Error('PayPal credentials are not configured');
  }
  const res = await fetch(apiBase() + '/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(id + ':' + secret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) throw new Error('PayPal authentication failed');
  return data.access_token as string;
}

// Base44 forbids bulk updates on User, even for a single ID. Use its
// supported per-user update and verify the persisted claim. This is not an
// atomic compare-and-set, so PayPal request idempotency is additionally
// scoped to the account and UTC day to protect concurrent creation requests.
// An abandoned checkout must never lock a customer out permanently. A claim is
// recyclable once its earlier agreement is verified closed/absent at PayPal, or
// once the claim itself is older than this lease. Open agreements still block.
const CHECKOUT_CLAIM_LEASE_MS = 30 * 60 * 1000;
// An approval that PayPal never completed is treated as abandoned after a day.
const ABANDONED_PENDING_MS = 24 * 60 * 60 * 1000;

async function reservePayPalCheckout(
  users: any,
  userId: string,
  claimId: string,
  releasedClaimKeys: Set<string>,
): Promise<boolean> {
  const current = await users.get(userId);
  if (!current) return false;
  const previousClaim = typeof current.paypal_checkout_claim_id === 'string'
    ? current.paypal_checkout_claim_id : '';
  if (previousClaim && previousClaim !== claimId) {
    const claimedAt = Date.parse(String(current.paypal_checkout_claimed_at || ''));
    const claimIsStale = !Number.isFinite(claimedAt) || Date.now() - claimedAt > CHECKOUT_CLAIM_LEASE_MS;
    if (!releasedClaimKeys.has(previousClaim) && !claimIsStale) return false;
  }
  await users.update(userId, {
    paypal_checkout_claim_id: claimId,
    paypal_checkout_claimed_at: new Date().toISOString(),
  });
  const persisted = await users.get(userId);
  return persisted?.paypal_checkout_claim_id === claimId;
}

// PayPal-Request-Id must distinguish SKU changes. Per-account/day only keys
// collide when a customer chooses Premium Plus after attempting Premium.
// The existing subscription verification and reservation guards remain in force.

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  let checkoutStage = 'authenticate';
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
    const item = CATALOG[sku];
    if (!item) return Response.json({ error: 'Unknown subscription plan' }, { status: 400 });
    const planId = secrets.get(item.secret);
    // Reject placeholder or malformed plan IDs before obtaining an agreement
    // reservation. A failed provider request can otherwise leave an uncertain
    // checkout claim that blocks legitimate upgrades.
    if (typeof planId !== 'string' || !/^P-[A-Z0-9]{10,}$/.test(planId.trim())) {
      return Response.json({
        error: 'This subscription plan is temporarily unavailable. Please contact NaliChat support.',
        code: 'PAYPAL_PLAN_CONFIGURATION_REQUIRED',
      }, { status: 503 });
    }

    // Block duplicate checkout if the user already has active paid access.
    checkoutStage = 'load_subscriptions';
    const allSubsResult = await base44.asServiceRole.entities.Subscription.filter(
      { user_id: user.id }, '-created_date', 500,
    );
    const allSubs = Array.isArray(allSubsResult) ? allSubsResult : allSubsResult?.data;
    if (!Array.isArray(allSubs)) throw new Error('Subscription query returned an invalid result');
    if (allSubs.length >= 500) return Response.json({ error: 'Subscription history requires review before starting another checkout' }, { status: 409 });
    // Only a live agreement blocks a new checkout. A canceled plan that still
    // has access until its period end no longer bills, so its owner must be able
    // to start or upgrade to a new plan immediately.
    const alreadyPaid = allSubs.some((sub: any) => {
      const plan = normalizePlan(sub.plan);
      const status = normalizeStatus(sub.status);
      return plan !== 'free' && hasLiveSubscription(status, sub.cancel_at_period_end === true);
    });
    if (alreadyPaid) {
      return Response.json({ error: 'This account already has a paid subscription. Manage your existing subscription in Settings before starting another checkout.' }, { status: 409 });
    }

    checkoutStage = 'paypal_authentication';
    const token = await accessToken();
    // Confirm the selected PayPal plan is active before reserving the account.
    // A stale or inactive plan should not create a checkout claim or an
    // uncertain recurring agreement that blocks subsequent legitimate attempts.
    checkoutStage = 'verify_plan_configuration';
    const planLookup = await fetch(apiBase() + '/v1/billing/plans/' + encodeURIComponent(planId), {
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
    });
    if (!planLookup.ok) {
      console.error('PayPal checkout plan lookup failed', { sku, status: planLookup.status });
      return Response.json({
        error: 'This PayPal subscription plan is temporarily unavailable. Please contact NaliChat support.',
        code: planLookup.status === 404 || planLookup.status === 400
          ? 'PAYPAL_PLAN_CONFIGURATION_REQUIRED' : 'CHECKOUT_DEPENDENCY_ERROR',
      }, { status: 503 });
    }
    const verifiedPlan = await planLookup.json().catch(() => null);
    if (verifiedPlan?.id !== planId || verifiedPlan?.status !== 'ACTIVE') {
      console.error('PayPal checkout plan not active', { sku, status: verifiedPlan?.status || 'missing' });
      return Response.json({
        error: 'This PayPal subscription plan is not currently active. Please contact NaliChat support.',
        code: 'PAYPAL_PLAN_CONFIGURATION_REQUIRED',
      }, { status: 503 });
    }
    // Verify all prior PayPal agreements with PayPal before deciding whether
    // a locally pending row actually represents an open recurring agreement.
    // Fail closed on stale local statuses: check every other recorded PayPal
    // agreement with PayPal before creating a new recurring billing agreement.
    const environment = (secrets.get('PAYPAL_ENVIRONMENT') || 'live').toLowerCase();
    const releasedClaimKeys = new Set<string>();
    const releaseAbandoned = async (prior: any) => {
      if (typeof prior.checkout_request_key === 'string' && prior.checkout_request_key) {
        releasedClaimKeys.add(prior.checkout_request_key);
      }
      // A pending row PayPal no longer holds is cleared so it stops showing as
      // an unfinished checkout. Paid access is never affected.
      if (prior.status !== 'pending' || typeof prior.id !== 'string') return;
      try {
        await base44.asServiceRole.entities.Subscription.update(prior.id, { status: 'ended' });
      } catch {
        console.warn('Could not clear stale pending PayPal record', { subscriptionRecordId: prior.id });
      }
    };
    // Only locally open rows can represent a live agreement worth blocking on.
    // Historic canceled/ended rows are left alone instead of being re-verified.
    const openLocalStatuses = new Set(['pending', 'active', 'trialing', 'unpaid', 'incomplete', 'trial']);
    for (const prior of allSubs.filter((sub: any) =>
      sub.provider === 'paypal' && sub.subscription_id &&
      openLocalStatuses.has(String(sub.status || '')))) {
      // An agreement recorded under another PayPal environment cannot be the
      // open agreement this checkout would duplicate.
      if (prior.paypal_environment !== environment || !prior.paypal_plan_id) {
        await releaseAbandoned(prior);
        continue;
      }
      const lookup = await fetch(apiBase() + '/v1/billing/subscriptions/' + encodeURIComponent(prior.subscription_id), {
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      });
      // PayPal holds no such agreement under these credentials, so it cannot
      // be billed again and must not block a fresh checkout.
      if (lookup.status === 404 || lookup.status === 400) {
        await releaseAbandoned(prior);
        continue;
      }
      if (!lookup.ok) return Response.json({ error: 'Unable to verify previous PayPal billing' }, { status: 503 });
      const remote = await lookup.json();
      // A canceled agreement must belong to this exact customer and SKU.
      if (remote?.id !== prior.subscription_id || remote?.plan_id !== prior.paypal_plan_id ||
          !prior.sku || remote?.custom_id !== user.id + ':' + prior.sku) {
        return Response.json({ error: 'Previous PayPal billing identity needs review before another subscription' }, { status: 409 });
      }
      const providerStatus = String(remote?.status || '').toUpperCase();
      if (['CANCELLED', 'EXPIRED'].includes(providerStatus)) {
        await releaseAbandoned(prior);
        continue;
      }
      // An approval PayPal never activated for a day is abandoned. Let the
      // customer start over instead of staying blocked indefinitely.
      const createdAt = Date.parse(String(prior.created_date || ''));
      const abandoned = prior.status === 'pending' &&
        ['APPROVAL_PENDING', 'APPROVED', 'CREATED'].includes(providerStatus) &&
        Number.isFinite(createdAt) && Date.now() - createdAt > ABANDONED_PENDING_MS;
      if (abandoned) {
        console.warn('Releasing abandoned PayPal approval', { subscriptionRecordId: prior.id });
        await releaseAbandoned(prior);
        continue;
      }
      return Response.json({
        error: providerStatus === 'APPROVAL_PENDING'
          ? 'Your previous PayPal approval is still pending. Continue that approval in Settings rather than starting another.'
          : 'Previous PayPal billing needs review before another subscription',
        code: 'PAYPAL_AGREEMENT_RECONCILIATION_REQUIRED',
      }, { status: 409 });
    }
    // Acquire a durable per-account claim immediately before the first PayPal
    // subscription creation request.
    checkoutStage = 'reserve_checkout';
    const reserved = await reservePayPalCheckout(base44.asServiceRole.entities.User, user.id, idempotencyKey, releasedClaimKeys);
    if (!reserved) {
      return Response.json({ error: 'A PayPal checkout has already been started. Check billing before starting another.' }, { status: 409 });
    }
    // This claim is intentionally NOT released in catch or after a timeout.
    // The provider may have created an agreement even if the response fails.
    // Always return buyers to the canonical site. The platform app URL can still
    // be the old Base44 host, and a session on nalichat.org cannot confirm a
    // payment that lands on a different origin.
    const successUrl = new URL('/ThankYou?subscription=1', APP_BASE_URL).toString();
    const cancelUrl = new URL('/pricing?checkout=paypal_canceled', APP_BASE_URL).toString();
    checkoutStage = 'paypal_create_subscription';
    const res = await fetch(apiBase() + '/v1/billing/subscriptions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'PayPal-Request-Id': await paypalSubscriptionRequestId(user.id, sku),
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
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      // A failed provider response does not prove that no agreement was created.
      // Keep the account claim and direct the customer to billing review.
      console.error('PayPal subscription creation failed', { status: res.status, issue: data?.name || 'provider_error' });
      return Response.json({
        error: 'PayPal could not confirm this checkout. Review billing before trying again to avoid duplicate subscriptions.',
        code: 'PAYPAL_CHECKOUT_UNCERTAIN',
      }, { status: 503 });
    }
    const approval = Array.isArray(data.links) ? data.links.find((x: any) => x.rel === 'approve')?.href : '';
    let verifiedApproval: URL;
    try { verifiedApproval = new URL(approval); } catch {
      return Response.json({ error: 'PayPal approval could not be validated; check billing before retrying' }, { status: 502 });
    }
    const expectedHost = (secrets.get('PAYPAL_ENVIRONMENT') || 'live').toLowerCase() === 'sandbox'
      ? 'www.sandbox.paypal.com' : 'www.paypal.com';
    if (!data.id || verifiedApproval.protocol !== 'https:' || verifiedApproval.hostname !== expectedHost) {
      return Response.json({ error: 'PayPal approval identity could not be validated; check billing before retrying' }, { status: 502 });
    }

    checkoutStage = 'persist_pending_subscription';
    try {
      await base44.asServiceRole.entities.Subscription.create({
        user_id: user.id,
        plan: item.plan,
        status: 'pending',
        provider: 'paypal',
        billing_period: item.billingPeriod,
        sku,
        subscription_id: data.id,
        paypal_plan_id: planId,
        paypal_environment: (secrets.get('PAYPAL_ENVIRONMENT') || 'live').toLowerCase(),
        checkout_url: verifiedApproval.toString(),
        checkout_request_key: idempotencyKey,
      });
    } catch (persistError) {
      // The write can land even when its response is lost. Re-read before
      // failing so the agreement is never left without its buyer record.
      const existing = await base44.asServiceRole.entities.Subscription.filter(
        { provider: 'paypal', subscription_id: data.id }, '-created_date', 2,
      );
      if (!Array.isArray(existing) || existing.length !== 1) {
        console.error('Failed to persist pending PayPal subscription:', persistError);
        throw new Error('Unable to persist subscription record');
      }
    }

    return Response.json({
      success: true,
      action: 'create_paypal_subscription',
      userId: user.id,
      sku,
      checkoutUrl: verifiedApproval.toString(),
      subscriptionId: data.id,
    });
  } catch (error) {
    console.error('PayPal checkout error at stage', checkoutStage, error);
    // Do not retry an uncertain PayPal creation automatically: the provider
    // may have created a recurring agreement even when the response was lost.
    const providerMayHaveCreatedAgreement = checkoutStage === 'paypal_create_subscription' || checkoutStage === 'persist_pending_subscription';
    return Response.json({
      error: providerMayHaveCreatedAgreement
        ? 'PayPal checkout could not be confirmed. Check billing before retrying.'
        : 'Subscription checkout is temporarily unavailable. Please try again later.',
      code: providerMayHaveCreatedAgreement ? 'PAYPAL_CHECKOUT_UNCERTAIN' : 'CHECKOUT_DEPENDENCY_ERROR',
    }, { status: 503 });
  }
});