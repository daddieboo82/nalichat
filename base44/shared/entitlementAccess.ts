import {
  normalizePlan,
  normalizeStatus,
  resolveEntitlements,
  type EntitlementKey,
} from './subscription.ts';

export async function resolveUserEntitlements(entities: any, userId: string) {
  const subscriptions = await entities.Subscription.filter({ user_id: userId });
  const now = new Date().toISOString();

  let best = resolveEntitlements('free', 'active', { now });
  const score = (e: any) =>
    Number(Boolean(e['ai.best_model'])) * 4
    + Number(Boolean(e['ai.high_limits'])) * 2
    + Number(Boolean(e['ai.standard']));

  for (const subscription of subscriptions) {
    const plan = normalizePlan(subscription.plan);
    const status = normalizeStatus(subscription.status);
    const entitlements = resolveEntitlements(plan, status, {
      currentPeriodEnd: subscription.current_period_end || null,
      trialEndDate: subscription.trial_end_date || null,
      now,
    });
    if (score(entitlements) > score(best)) best = entitlements;
  }
  return best;
}

export async function requireEntitlement(
  entities: any,
  userId: string,
  entitlement: EntitlementKey,
) {
  const entitlements = await resolveUserEntitlements(entities, userId);
  return {
    allowed: Boolean(entitlements[entitlement]),
    entitlements,
  };
}

export function preferredAiModel(entitlements: Record<string, boolean>) {
  return entitlements['ai.best_model'] ? 'claude_opus_4_8' : undefined;
}
