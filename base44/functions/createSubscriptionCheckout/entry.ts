import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { secrets } from 'base44:runtime';
import {
  resolveCheckoutUrls,
  resolveStripeSku,
  stripeCheckoutIdempotencyKey,
  stripeEnvironmentFromSecretKey,
  trialEligibility,
  validateCheckoutIdempotencyKey,
} from '../../shared/stripeBilling.ts';
import { hasPaidTierAccess, normalizePlan, normalizeStatus } from '../../shared/subscription.ts';
import { stripeRequest } from '../../shared/stripe.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { APP_BASE_URL } from '../../shared/appConfig.ts';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';

const TRIAL_DAYS = 7;
const CHECKOUT_LEASE_MS = 24 * 60 * 60 * 1000;

async function loadUserSubscriptions(entity: any, userId: string) {
  const rows: any[] = [];
  const pageSize = 200;
  for (let skip = 0; ; skip += pageSize) {
    const page = await entity.filter(
      { user_id: userId },
      '-created_date',
      pageSize,
      skip,
    );
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Failed to create subscription checkout';
}

function isClientError(message: string): boolean {
  return message.startsWith('Unknown ')
    || message.startsWith('callbackDestinations ')
    || message.startsWith('idempotencyKey ');
}

function metadataFor(
  userId: string,
  sku: { sku: string; plan: string; billingPeriod: string },
  environment: string,
): Record<string, string> {
  return {
    nali_user_id: userId,
    nali_plan: sku.plan,
    nali_period: sku.billingPeriod,
    nali_sku: sku.sku,
    nali_environment: environment,
  };
}

async function checkoutRecordId(userId: string, requestKey: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${userId}:${requestKey}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const suffix = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `stripe_checkout_${suffix}`;
}

Deno.serve(async (req) => {
  let cleanupBase44: any = null;
  let cleanupUserId = '';
  let cleanupRequestKey = '';
  let cleanupTrialClaimed = false;
  let cleanupSessionCreated = false;

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = await readJsonBodyLimited(req, 16 * 1024);
    const sku = resolveStripeSku(body?.sku, (name) => secrets.get(name));
    const requestKey = validateCheckoutIdempotencyKey(body?.idempotencyKey);
    cleanupRequestKey = requestKey;
    const callbackUrls = resolveCheckoutUrls(body?.callbackDestinations, APP_BASE_URL);
    const environment = stripeEnvironmentFromSecretKey(secrets.get('STRIPE_SECRET_KEY'));

    const base44 = createClientFromRequest(req);
    cleanupBase44 = base44;
    let user;
    try {
      user = await base44.auth.me();
    } catch {
      return Response.json({ error: 'Authentication required for subscriptions' }, { status: 401 });
    }
    if (!user?.id) {
      return Response.json({ error: 'Authentication required for subscriptions' }, { status: 401 });
    }
    if (user.is_banned) {
      return Response.json({ error: 'banned' }, { status: 403 });
    }
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json(
        { error: 'timed_out', timeout_until: user.timeout_until },
        { status: 403 },
      );
    }
    cleanupUserId = user.id;

    const checkoutRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'subscription_checkout',
      12,
    );
    if (!checkoutRate.allowed) {
      return Response.json(
        { error: 'Too many subscription checkout attempts. Please try again later.' },
        { status: 429 },
      );
    }

    const [existingAttempts, subscriptions] = await Promise.all([
      base44.asServiceRole.entities.Subscription.filter(
        {
          user_id: user.id,
          checkout_request_key: requestKey,
          provider: 'stripe',
        },
        '-created_date',
        2,
      ),
      loadUserSubscriptions(
        base44.asServiceRole.entities.Subscription,
        user.id,
      ),
    ]);
    if (existingAttempts.length > 1) {
      throw new Error('Duplicate checkout request records require operator reconciliation');
    }
    let pendingSubscription = existingAttempts[0] || null;
    if (
      pendingSubscription
      && (
        pendingSubscription.sku !== sku.sku
        || pendingSubscription.stripe_environment !== environment
        || pendingSubscription.checkout_success_destination !== body.callbackDestinations.success
        || pendingSubscription.checkout_cancel_destination !== body.callbackDestinations.cancel
      )
    ) {
      return Response.json(
        { error: 'idempotencyKey was already used for different checkout parameters' },
        { status: 409 },
      );
    }
    if (
      pendingSubscription?.checkout_url
      && pendingSubscription.checkout_id
      && typeof pendingSubscription.checkout_expires_at === 'string'
      && Date.parse(pendingSubscription.checkout_expires_at) > Date.now()
    ) {
      return Response.json({
        success: true,
        action: 'create_subscription_checkout',
        userId: user.id,
        sku: sku.sku,
        idempotencyKey: requestKey,
        successDestination: body.callbackDestinations.success,
        cancelDestination: body.callbackDestinations.cancel,
        checkoutUrl: pendingSubscription.checkout_url,
        checkoutId: pendingSubscription.checkout_id,
        trialApplied: Boolean(
          !user.trial_used_at && user.trial_claim_id === requestKey
        ),
        reused: true,
      });
    }

    const now = new Date().toISOString();
    const existingPaidSubscription = subscriptions.find(
      (subscription: Record<string, unknown>) => (
        normalizePlan(subscription.plan) !== 'free'
        && hasPaidTierAccess(normalizeStatus(subscription.status), {
          currentPeriodEnd: typeof subscription.current_period_end === 'string'
            ? subscription.current_period_end
            : null,
          trialEndDate: typeof subscription.trial_end_date === 'string'
            ? subscription.trial_end_date
            : null,
          now,
        })
      ),
    );
    if (existingPaidSubscription) {
      const message = existingPaidSubscription.grandfathered === true
        ? 'This account already has grandfathered Premium Plus billing'
        : 'This account already has a paid subscription; use the billing portal';
      return Response.json({ error: message }, { status: 409 });
    }

    const checkoutLeaseCutoff = new Date(Date.now() - CHECKOUT_LEASE_MS).toISOString();
    const currentUsers = await base44.asServiceRole.entities.User.filter({ id: user.id }, '-created_date', 1);
    const currentUser = currentUsers[0];
    const activeClaimId = typeof currentUser?.stripe_checkout_claim_id === 'string'
      ? currentUser.stripe_checkout_claim_id
      : '';
    const activeClaimedAt = typeof currentUser?.stripe_checkout_claimed_at === 'string'
      ? currentUser.stripe_checkout_claimed_at
      : '';
    const claimIsStale = !activeClaimedAt || activeClaimedAt < checkoutLeaseCutoff;
    if (activeClaimId && activeClaimId !== requestKey && !claimIsStale) {
      return Response.json(
        { error: 'Another subscription checkout is already in progress' },
        { status: 409 },
      );
    }
    await base44.asServiceRole.entities.User.update(user.id, {
      stripe_checkout_claim_id: requestKey,
      stripe_checkout_claimed_at: now,
    });
    const checkoutClaimUsers = await base44.asServiceRole.entities.User.filter({ id: user.id }, '-created_date', 1);
    if (
      checkoutClaimUsers.length !== 1
      || checkoutClaimUsers[0].stripe_checkout_claim_id !== requestKey
    ) {
      return Response.json(
        { error: 'Another subscription checkout is already in progress' },
        { status: 409 },
      );
    }

    let customerId = typeof user.stripe_customer_id === 'string'
      ? user.stripe_customer_id
      : '';
    const metadata = metadataFor(user.id, sku, environment);
    if (!customerId) {
      const customer = await stripeRequest(
        '/customers',
        {
          email: user.email || undefined,
          metadata: {
            nali_user_id: user.id,
            nali_environment: environment,
          },
        },
        'POST',
        { idempotencyKey: `nalichat_customer_${user.id}`.slice(0, 255) },
      );
      customerId = customer.id;
      await base44.asServiceRole.entities.User.update(user.id, {
        stripe_customer_id: customerId,
      });
    }

    let trialApplied = Boolean(
      !user.trial_used_at && user.trial_claim_id === requestKey
    );
    if (!pendingSubscription) {
      const eligibility = trialEligibility(user.trial_used_at, subscriptions);
      if (eligibility.eligible) {
        // The checkout lease above guarantees only this requestKey owns the
        // active checkout slot. If an older abandoned checkout left a stale
        // trial_claim_id behind, the new lease holder may safely replace it.
        const trialClaimUsers = await base44.asServiceRole.entities.User.filter({ id: user.id }, '-created_date', 1);
        const trialClaimUser = trialClaimUsers[0];
        if (!trialClaimUser?.trial_used_at && trialClaimUser?.stripe_checkout_claim_id === requestKey) {
          await base44.asServiceRole.entities.User.update(user.id, {
            trial_claim_id: requestKey,
          });
        }
        const refreshedUsers = await base44.asServiceRole.entities.User.filter({ id: user.id }, '-created_date', 1);
        trialApplied = refreshedUsers.length === 1
          && !refreshedUsers[0].trial_used_at
          && refreshedUsers[0].trial_claim_id === requestKey;
        cleanupTrialClaimed = trialApplied;
      }

      const recordId = await checkoutRecordId(user.id, requestKey);
      try {
        pendingSubscription = await base44.asServiceRole.entities.Subscription.create({
          id: recordId,
          user_id: user.id,
          plan: sku.plan,
          status: 'pending',
          provider: 'stripe',
          billing_period: sku.billingPeriod,
          sku: sku.sku,
          stripe_price_id: sku.priceId,
          stripe_customer_id: customerId,
          stripe_environment: environment,
          checkout_request_key: requestKey,
          checkout_success_destination: body.callbackDestinations.success,
          checkout_cancel_destination: body.callbackDestinations.cancel,
          trial_target_plan: sku.plan,
        });
      } catch (createError) {
        const concurrentAttempts = await base44.asServiceRole.entities.Subscription.filter(
          {
            checkout_request_key: requestKey,
            user_id: user.id,
            provider: 'stripe',
          },
          '-created_date',
          2,
        );
        if (concurrentAttempts.length !== 1) throw createError;
        pendingSubscription = concurrentAttempts[0];
        const refreshedUsers = await base44.asServiceRole.entities.User.filter({ id: user.id }, '-created_date', 1);
        trialApplied = refreshedUsers.length === 1
          && !refreshedUsers[0].trial_used_at
          && refreshedUsers[0].trial_claim_id === requestKey;
      }
    }

    let session;
    try {
      session = await stripeRequest(
        '/checkout/sessions',
        {
          mode: 'subscription',
          customer: customerId,
          client_reference_id: user.id,
          line_items: [{
            price: sku.priceId,
            quantity: 1,
          }],
          success_url: callbackUrls.successUrl,
          cancel_url: callbackUrls.cancelUrl,
          metadata,
          subscription_data: {
            metadata,
          },
        },
        'POST',
        {
          idempotencyKey: stripeCheckoutIdempotencyKey(user.id, requestKey),
        },
      );
      cleanupSessionCreated = true;
    } catch (error) {
      await base44.asServiceRole.entities.Subscription.update(pendingSubscription.id, {
        status: 'incomplete',
        checkout_error: errorMessage(error).slice(0, 1000),
      });
      throw error;
    }

    await base44.asServiceRole.entities.Subscription.update(pendingSubscription.id, {
      status: 'pending',
      checkout_id: session.id,
      checkout_url: session.url,
      checkout_expires_at: typeof session.expires_at === 'number'
        ? new Date(session.expires_at * 1000).toISOString()
        : new Date(Date.now() + CHECKOUT_LEASE_MS).toISOString(),
      checkout_error: '',
      stripe_customer_id: customerId,
    });

    return Response.json({
      success: true,
      action: 'create_subscription_checkout',
      userId: user.id,
      sku: sku.sku,
      idempotencyKey: requestKey,
      successDestination: body.callbackDestinations.success,
      cancelDestination: body.callbackDestinations.cancel,
      checkoutUrl: session.url,
      checkoutId: session.id,
      trialApplied,
      reused: false,
    });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    if (
      cleanupBase44
      && cleanupUserId
      && cleanupRequestKey
      && !cleanupSessionCreated
    ) {
      try {
        const cleanupUsers = await cleanupBase44.asServiceRole.entities.User.filter(
          { id: cleanupUserId },
          '-created_date',
          1,
        );
        if (cleanupUsers[0]?.stripe_checkout_claim_id === cleanupRequestKey) {
          await cleanupBase44.asServiceRole.entities.User.update(cleanupUserId, {
            stripe_checkout_claim_id: null,
            stripe_checkout_claimed_at: null,
            ...(cleanupTrialClaimed && cleanupUsers[0]?.trial_claim_id === cleanupRequestKey ? {
              trial_claim_id: null,
            } : {}),
          });
        }

      } catch (cleanupError) {
        console.error('Subscription checkout cleanup failed:', cleanupError);
      }
    }

    const message = errorMessage(error);
    console.error('Subscription checkout error:', error);
    return Response.json(
      { error: isClientError(message) ? message : 'Unable to create subscription checkout' },
      { status: isClientError(message) ? 400 : 500 },
    );
  }
});
