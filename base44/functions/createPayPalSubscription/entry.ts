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
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) throw new Error('PayPal authentication failed');
  return data.access_token as string;
}

// Base44 forbids bulk updates on User, even for a single ID. Use its
// supported per-user update and verify the persisted claim. This is not an
// atomic compare-and-set, so PayPal request idempotency is additionally
// scoped to the account and UTC day to protect concurrent creation requests.
async function reservePayPalCheckout(
  users: any,
  userId: string,
  claimId: string,
  verifiedTerminalClaimKeys: Set<string>,
): Promise<boolean> {
  const current = await users.get(userId);
  if (!current) return false;
  const previousClaim = typeof current.paypal_checkout_claim_id === 'string'
    ? current.paypal_checkout_claim_id : '';
  if (previousClaim) {
    // Never recycle an uncertain provider request. Reuse is permitted only
    // when a matching saved agreement was just verified CANCELLED/EXPIRED at
    // PayPal, and only on a later UTC day to avoid provider idempotency reuse.
    const previousDate = String(current.paypal_checkout_claimed_at || '').slice(0, 10);
    if (!verifiedTerminalClaimKeys.has(previousClaim) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(previousDate) ||
        previousDate >= new Date().toISOString().slice(0, 10)) return false;
  }
  await users.update(userId, {
    paypal_checkout_claim_id: claimId,
    paypal_checkout_claimed_at: new Date().toISOString(),
  });
  const persisted = await users.get(userId);
  return persisted?.paypal_checkout_claim_id === claimId;
}

// PayPal-Request-Id is limited to 38 single-byte characters. Hash the
// authenticated user and stable client request key into 36 hex chars.
// Identical retries produce the same provider idempotency key.
async function paypalRequestId(userId: string, _requestKey: string): Promise<string> {
  // A stable account/day key prevents different client request keys from
  // creating multiple PayPal agreements in a concurrent checkout race.
  const day = new Date().toISOString().slice(0, 10);
  const bytes = new TextEncoder().encode(userId + ':subscription:' + day);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 36);
}

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
    if (!planId) return Response.json({ error: 'PayPal plan is not configured yet', missingSecret: item.secret }, { status: 503 });

    // Block duplicate checkout if the user already has active paid access.
    checkoutStage = 'load_subscriptions';
    const allSubsResult = await base44.asServiceRole.entities.Subscription.filter(
      { user_id: user.id }, '-created_date', 100,
    );
    const allSubs = Array.isArray(allSubsResult) ? allSubsResult : allSubsResult?.data;
    if (!Array.isArray(allSubs)) throw new Error('Subscription query returned an invalid result');
    if (allSubs.length >= 100) return Response.json({ error: 'Subscription history requires review before starting another checkout' }, { status: 409 });
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
      return Response.json({ error: 'This account already has a paid subscription. Manage your existing subscription in Settings before starting another checkout.' }, { status: 409 });
    }

    checkoutStage = 'paypal_authentication';
    const token = await accessToken();
    // Verify all prior PayPal agreements with PayPal before deciding whether
    // a locally pending row actually represents an open recurring agreement.
    // Fail closed on stale local statuses: check every other recorded PayPal
    // agreement with PayPal before creating a new recurring billing agreement.
    const verifiedTerminalClaimKeys = new Set<string>();
    for (const prior of allSubs.filter((sub: any) => sub.provider === 'paypal' && sub.subscription_id)) {
      if (prior.paypal_environment !== (secrets.get('PAYPAL_ENVIRONMENT') || 'live').toLowerCase() || !prior.paypal_plan_id) {
        return Response.json({ error: 'Previous PayPal billing requires account review' }, { status: 409 });
      }
      const lookup = await fetch(apiBase() + '/v1/billing/subscriptions/' + encodeURIComponent(prior.subscription_id), {
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      });
      if (!lookup.ok) return Response.json({ error: 'Unable to verify previous PayPal billing' }, { status: 503 });
      const remote = await lookup.json();
      // A canceled agreement must belong to this exact customer and SKU.
      // Without custom_id validation, a foreign agreement could be accepted
      // as evidence that the account is safe to bill again.
      if (remote?.id !== prior.subscription_id || remote?.plan_id !== prior.paypal_plan_id ||
          !prior.sku || remote?.custom_id !== user.id + ':' + prior.sku) {
        return Response.json({ error: 'Previous PayPal billing identity needs review before another subscription' }, { status: 409 });
      }
      const providerStatus = String(remote?.status || '').toUpperCase();
      // Only a verified terminal agreement permits a new checkout. A stale
      // local "pending" row can be ignored if PayPal has truly ended it.
      // APPROVED, ACTIVE, APPROVAL_PENDING, SUSPENDED and unknown remain blocked.
      if (!['CANCELLED', 'EXPIRED'].includes(providerStatus)) {
        return Response.json({
          error: providerStatus === 'APPROVAL_PENDING'
            ? 'Your previous PayPal approval is still pending. Continue that approval in Settings rather than starting another.'
            : 'Previous PayPal billing needs review before another subscription',
          code: 'PAYPAL_AGREEMENT_RECONCILIATION_REQUIRED',
        }, { status: 409 });
      }
      if (typeof prior.checkout_request_key === 'string' && prior.checkout_request_key) {
        verifiedTerminalClaimKeys.add(prior.checkout_request_key);
      }
    }
    // Acquire a durable per-account compare-and-set claim immediately before
    // the first PayPal subscription creation request.
    checkoutStage = 'reserve_checkout';
    const reserved = await reservePayPalCheckout(base44.asServiceRole.entities.User, user.id, idempotencyKey, verifiedTerminalClaimKeys);
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
        'PayPal-Request-Id': await paypalRequestId(user.id, idempotencyKey),
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