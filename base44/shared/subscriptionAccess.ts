import {
  hasPaidTierAccess,
  normalizePlan,
  normalizeStatus,
  resolveEntitlements,
} from './subscription.ts';

const PAGE_SIZE = 500;

export interface SubscriptionRecord extends Record<string, unknown> {
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
    if (page.length < PAGE_SIZE) return subscriptions;
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

export async function resolveUserSubscription(
  subscriptionEntity: SubscriptionEntity,
  userId: string,
  now = new Date().toISOString(),
) {
  const subscriptions = await loadUserSubscriptions(subscriptionEntity, userId);
  const ranked = [...subscriptions].sort(
    (left, right) => subscriptionPriority(right, now) - subscriptionPriority(left, now),
  );
  const selected = ranked[0] || null;
  const plan = selected ? normalizePlan(selected.plan) : 'free';
  const status = selected ? normalizeStatus(selected.status) : 'active';
  const currentPeriodEnd = selected?.current_period_end || null;
  const trialEndDate = selected?.trial_end_date || null;
  const hasPaidAccess = plan !== 'free' && hasPaidTierAccess(status, {
    currentPeriodEnd,
    trialEndDate,
    now,
  });

  return {
    subscriptions,
    selected,
    plan,
    status,
    currentPeriodEnd,
    trialEndDate,
    hasPaidAccess,
    entitlements: resolveEntitlements(plan, status, {
      currentPeriodEnd,
      trialEndDate,
      now,
    }),
  };
}
