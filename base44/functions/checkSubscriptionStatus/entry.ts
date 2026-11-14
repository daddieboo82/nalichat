import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import {
  entitlementStatusForProvider,
  hasPaidTierAccess,
  normalizePlan,
  normalizeStatus,
  resolveEntitlements,
} from '../../shared/subscription.ts';
import { paypalPeriodEndForStatus, resolvePayPalSubscriptionStatus } from '../../shared/paypalSubscription.ts';
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
  const nowMs = Date.now();
  // Recover pending approvals and revalidate active PayPal records whose
  // locally stored billing boundary is already past. A stale local period
  // must not permanently deny a subscriber who renewed at the provider.
  const unresolved = subscriptions.filter((subscription) => {
    if (subscription.provider !== 'paypal' ||
        typeof subscription.id !== 'string' ||
        typeof subscription.subscription_id !== 'string') return false;
    if (subscription.status === 'pending') return true;
    if (subscription.status !== 'active') return false;
    // Missing/malformed billing dates are unresolved too.
    const periodEndMs = typeof subscription.current_period_end === 'string'
      ? Date.parse(subscription.current_period_end)
      : Number.NaN;
    return !Number.isFinite(periodEndMs) || periodEndMs <= nowMs;
  });
  const staleActive = unresolved.filter((subscription) => subscription.status === 'active');
  const pending = unresolved.filter((subscription) => subscription.status === 'pending');
  // Avoid a fixed first-ten priority: a permanently unverifiable stale
  // active row must not starve pending purchases, and older rows in either
  // group must eventually be retried. Rotate the starting index by minute.
  const selectRotating = (rows: SubscriptionRecord[], limit: number) => {
    if (!rows.length || limit <= 0) return [];
    const start = Math.floor(nowMs / 60_000) % rows.length;
    return rows.slice(start).concat(rows.slice(0, start)).slice(0, limit);
  };
  const candidates = [
    ...selectRotating(staleActive, 5),
    ...selectRotating(pending, 5),
  ];
  if (candidates.length < 10) {
    const selectedIds = new Set(candidates.map((row) => row.id));
    const remaining = unresolved.filter((row) => !selectedIds.has(row.id));
    candidates.push(...selectRotating(remaining, 10 - candidates.length));
  }
  if (!candidates.length) return;
  try {
    const token = await paypalAccessToken();
    if (!token) return;
    for (const subscription of candidates) {
      try {
        const response = await fetch(paypalApiBase() + '/v1/billing/subscriptions/' + encodeURIComponent(subscription.subscription_id as string), {
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      });
      if (!response.ok) continue;
      const remote = await response.json();
      // The resolver can POST /activate whenever PayPal reports APPROVED.
      // Every candidate (including a locally active row with stale billing)
      // must match the provider plan and account before any such mutation.
      // An unverifiable legacy row stays unchanged for manual review.
      if (typeof subscription.paypal_plan_id !== 'string' ||
          typeof subscription.user_id !== 'string' ||
          typeof subscription.sku !== 'string' ||
          remote?.plan_id !== subscription.paypal_plan_id ||
          remote?.custom_id !== subscription.user_id + ':' + subscription.sku) {
        continue;
      }
      const remoteStatus = await resolvePayPalSubscriptionStatus(
        paypalApiBase(),
        token,
        subscription.subscription_id as string,
        remote,
      );
      const status = paypalStatus(remoteStatus);
      if (!status) continue;
      const update: Record<string, unknown> = { status };
      const periodEnd = paypalPeriodEndForStatus(status, remote?.billing_info?.next_billing_time);
      // A newly approved checkout must not turn into indefinite access if
      // PayPal omits a usable future billing boundary.
      if (subscription.status === 'pending' && status === 'active' &&
          (typeof periodEnd !== 'string' || Date.parse(periodEnd) <= nowMs)) {
        continue;
      }
      // For every PayPal ACTIVE record, write a billing boundary only when
      // PayPal provided a verified future date. Missing or expired provider
      // billing data must never clear a stored boundary or replace it with
      // null: other access helpers interpret active + null as unlimited.
      if (status === 'active') {
        if (typeof periodEnd === 'string' && Date.parse(periodEnd) > nowMs) {
          update.current_period_end = periodEnd;
        }
      } else if (periodEnd !== undefined) {
        update.current_period_end = periodEnd;
      }
      if (status === 'canceled') update.cancel_at_period_end = false;
      await subscriptionEntity.update(subscription.id as string, update);
      Object.assign(subscription, update);
      } catch (error) {
        // Continue verifying other subscriptions even if one provider
        // lookup or entity update fails; never promote unverified access.
        console.error('PayPal subscription lookup or update failed', error);
      }
    }
  } catch (error) {
    console.error('PayPal status reconciliation failed', error);
  }
}

function subscriptionPriority(subscription: SubscriptionRecord, now: string): number {
  const plan = normalizePlan(subscription.plan);
  const status = normalizeStatus(subscription.status);
  const accessStatus = entitlementStatusForProvider(
    subscription.provider, status, subscription.current_period_end, now,
  );
  const hasPaidAccess = plan !== 'free' && hasPaidTierAccess(accessStatus, {
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
    const accessStatus = entitlementStatusForProvider(selected?.provider, status, currentPeriodEnd, now);
    const hasPaidAccess = plan !== 'free' && hasPaidTierAccess(accessStatus, {
      currentPeriodEnd,
      trialEndDate: selected?.trial_end_date || null,
      now,
    });
    const entitlements = resolveEntitlements(plan, accessStatus, {
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