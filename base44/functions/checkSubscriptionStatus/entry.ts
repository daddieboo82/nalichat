import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import {
  hasPaidTierAccess,
  normalizePlan,
  normalizeStatus,
  resolveEntitlements,
} from '../../shared/subscription.ts';
import { trialEligibility } from '../../shared/stripeBilling.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

const PAGE_SIZE = 500;

interface SubscriptionRecord extends Record<string, unknown> {
  id?: string;
  subscription_id?: string | null;
  plan?: unknown;
  status?: unknown;
  billing_period?: string | null;
  provider?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
  trial_started_at?: string | null;
  trial_end_date?: string | null;
  trial_used_at?: string | null;
  grandfathered?: boolean | null;
  grandfathered_from_plan?: string | null;
}

interface SubscriptionEntity {
  filter(
    query: Record<string, unknown>,
    sort: string,
    limit: number,
    skip: number,
  ): Promise<SubscriptionRecord[]>;
  update(id: string, data: Record<string, unknown>): Promise<unknown>;
}

async function loadUserSubscriptions(
  subscriptionEntity: SubscriptionEntity,
  userId: string,
): Promise<SubscriptionRecord[]> {
  const subscriptions: SubscriptionRecord[] = [];
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const page = await subscriptionEntity.filter(
      { user_id: userId },
      '-created_date',
      PAGE_SIZE,
      skip,
    );
    subscriptions.push(...page);
    if (page.length < PAGE_SIZE) {
      return subscriptions;
    }
  }
}

function paypalApiBase() {
  return (secrets.get('PAYPAL_ENVIRONMENT') || 'live').toLowerCase() === 'sandbox'
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';
}

async function paypalAccessToken() {
  const id = secrets.get('PAYPAL_CLIENT_ID');
  const secret = secrets.get('PAYPAL_CLIENT_SECRET');
  if (!id || !secret) return null;
  const response = await fetch(paypalApiBase() + '/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(id + ':' + secret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await response.json();
  return response.ok && data?.access_token ? String(data.access_token) : null;
}

function paypalStatus(status: unknown) {
  const value = String(status || '').toUpperCase();
  if (value === 'ACTIVE') return 'active';
  if (value === 'CANCELLED' || value === 'EXPIRED') return 'canceled';
  if (value === 'SUSPENDED') return 'unpaid';
  return null;
}

async function reconcilePendingPayPal(subscriptionEntity: SubscriptionEntity, subscriptions: SubscriptionRecord[]) {
  const pending = subscriptions.filter((subscription) =>
    subscription.provider === 'paypal' && subscription.status === 'pending' &&
    typeof subscription.id === 'string' && typeof subscription.subscription_id === 'string'
  ).slice(0, 10);
  if (!pending.length) return;
  try {
    const token = await paypalAccessToken();
    if (!token) return;
    for (const subscription of pending) {
      const response = await fetch(paypalApiBase() + '/v1/billing/subscriptions/' + encodeURIComponent(subscription.subscription_id as string), {
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      });
      if (!response.ok) continue;
      const remote = await response.json();
      const status = paypalStatus(remote?.status);
      if (!status) continue;
      const update: Record<string, unknown> = { status };
      const nextBilling = remote?.billing_info?.next_billing_time;
      if (typeof nextBilling === 'string') update.current_period_end = nextBilling;
      await subscriptionEntity.update(subscription.id as string, update);
      Object.assign(subscription, update);
    }
  } catch (error) {
    console.error('PayPal status reconciliation failed', error);
  }
}

function subscriptionPriority(subscription: SubscriptionRecord, now: string): number {
  const plan = normalizePlan(subscription.plan);
  const status = normalizeStatus(subscription.status);
  const hasPaidAccess = plan !== 'free' && hasPaidTierAccess(status, {
    currentPeriodEnd: typeof subscription.current_period_end === 'string'
      ? subscription.current_period_end
      : null,
    trialEndDate: typeof subscription.trial_end_date === 'string'
      ? subscription.trial_end_date
      : null,
    now,
  });
  const accessScore = hasPaidAccess ? 100 : status === 'pending' || status === 'incomplete' ? 10 : 0;
  const planScore = plan === 'premium_plus' ? 2 : plan === 'premium' ? 1 : 0;
  return accessScore + planScore;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const statusRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'subscription_status',
      600,
    );
    if (!statusRate.allowed) {
      return Response.json({ error: 'Subscription status rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const subscriptionEntity = base44.asServiceRole.entities.Subscription as SubscriptionEntity;
    const subs = await loadUserSubscriptions(
      subscriptionEntity,
      user.id,
    );
    await reconcilePendingPayPal(subscriptionEntity, subs);
    const now = new Date().toISOString();
    const ranked = [...subs].sort(
      (left, right) => subscriptionPriority(right, now) - subscriptionPriority(left, now),
    );
    const selected = ranked[0] || null;
    const plan = selected ? normalizePlan(selected.plan) : 'free';
    const status = selected ? normalizeStatus(selected.status) : 'active';
    const currentPeriodEnd = selected?.current_period_end || null;
    const hasPaidAccess = plan !== 'free' && hasPaidTierAccess(status, {
      currentPeriodEnd,
      trialEndDate: selected?.trial_end_date || null,
      now,
    });
    const entitlements = resolveEntitlements(plan, status, {
      currentPeriodEnd,
      trialEndDate: selected?.trial_end_date || null,
      now,
    });
    const hasPending = subs.some((subscription) => (
      subscription.status === 'pending' || subscription.status === 'incomplete'
    ));
    const eligibility = trialEligibility(user.trial_used_at, subs);

    return Response.json({
      success: true,
      action: 'check_subscription_status',
      userId: user.id,
      plan,
      status,
      billingPeriod: selected?.billing_period || null,
      provider: selected?.provider || null,
      currentPeriodEnd,
      renewsAt: hasPaidAccess && !selected?.cancel_at_period_end ? currentPeriodEnd : null,
      cancelAtPeriodEnd: selected?.cancel_at_period_end === true,
      trialStartedAt: selected?.trial_started_at || null,
      trialEndDate: selected?.trial_end_date || null,
      trialUsedAt: user.trial_used_at || selected?.trial_used_at || null,
      trialEligible: eligibility.eligible,
      trialEligibilityReason: eligibility.reason,
      grandfathered: selected?.grandfathered === true,
      grandfatheredFromPlan: selected?.grandfathered_from_plan || null,
      entitlements,
      hasPaidAccess,
      hasAccess: hasPaidAccess,
      hasPending,
      isTrialing: status === 'trialing' && hasPaidAccess,
    });
  } catch (error) {
    console.error('Check subscription error:', error);
    return Response.json({ error: 'Unable to check subscription' }, { status: 500 });
  }
});