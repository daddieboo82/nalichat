import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import {
  resolveCheckoutUrls,
  resolveStripeSku,
  stripeCheckoutIdempotencyKey,
  stripeEnvironment,
  trialEligibility,
  validateCheckoutIdempotencyKey,
} from '../../shared/stripeBilling.ts';
import { hasPaidTierAccess, normalizePlan, normalizeStatus } from '../../shared/subscription.ts';
import { stripeRequest } from '../../shared/stripe.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

const TRIAL_DAYS = 7;
const CHECKOUT_LEASE_MS = 24 * 60 * 60 * 1000;

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
    const body = await req.json();
    const sku = resolveStripeSku(body?.sku, (name) => Deno.env.get(name));
    const requestKey = validateCheckoutIdempotencyKey(body?.idempotencyKey);
    cleanupRequestKey = requestKey;
    const appBaseUrl = Deno.env.get('APP_BASE_URL');
    if (!appBaseUrl) throw new Error('Missing APP_BASE_URL');
    const callbackUrls = resolveCheckoutUrls(body?.callbackDestinations, appBaseUrl);
    const environment = stripeEnvironment(Deno.env.get('STRIPE_ENVIRONMENT'));

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

    const subscriptions = await base44.asServiceRole.entities.Subscription.filter({
      user_id: user.id,
    });
    const existingAttempts = subscriptions.filter(
      (subscription: Record<string, unknown>) => (
        subscription.checkout_request_key === requestKey
        && subscription.provider === 'stripe'
      ),
    );
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
    await base44.asServiceRole.entities.User.updateMany(
      {
        id: user.id,
        $or: [
          { stripe_checkout_claim_id: null },
          { stripe_checkout_claim_id: requestKey },
          { stripe_checkout_claimed_at: { $lt: checkoutLeaseCutoff } },
        ],
      },
      {
        $set: {
          stripe_checkout_claim_id: requestKey,
          stripe_checkout_claimed_at: now,
        },
      },
    );
    const checkoutClaimUsers = await base44.asServiceRole.entities.User.filter({ id: user.id });
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
        await base44.asServiceRole.entities.User.updateMany(
          {
            id: user.id,
            trial_used_at: null,
            stripe_checkout_claim_id: requestKey,
          },
          {
            $set: {
              trial_claim_id: requestKey,
            },
          },
        );
        const refreshedUsers = await base44.asServiceRole.entities.User.filter({ id: user.id });
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
        const concurrentAttempts = await base44.asServiceRole.entities.Subscription.filter({
          checkout_request_key: requestKey,
          user_id: user.id,
          provider: 'stripe',
        });
        if (concurrentAttempts.length !== 1) throw createError;
        pendingSubscription = concurrentAttempts[0];
        const refreshedUsers = await base44.asServiceRole.entities.User.filter({ id: user.id });
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
            ...(trialApplied ? { trial_period_days: TRIAL_DAYS } : {}),
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
      checkoutUrl: session.url,
      checkoutId: session.id,
      trialApplied,
      reused: false,
    });
  } catch (error) {
    if (
      cleanupBase44
      && cleanupUserId
      && cleanupRequestKey
      && !cleanupSessionCreated
    ) {
      try {
        await cleanupBase44.asServiceRole.entities.User.updateMany(
          {
            id: cleanupUserId,
            stripe_checkout_claim_id: cleanupRequestKey,
          },
          {
            $set: {
              stripe_checkout_claim_id: null,
              stripe_checkout_claimed_at: null,
              ...(cleanupTrialClaimed ? {
                trial_claim_id: null,
              } : {}),
            },
          },
        );

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
