import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { trialEligibility } from '../../shared/stripeBilling.ts';
import { resolveUserSubscription } from '../../shared/subscriptionAccess.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date().toISOString();
    const access = await resolveUserSubscription(
      base44.asServiceRole.entities.Subscription,
      user.id,
      now,
    );
    const { subscriptions, selected } = access;
    const hasPending = subscriptions.some((subscription) => (
      subscription.status === 'pending' || subscription.status === 'incomplete'
    ));
    const eligibility = trialEligibility(user.trial_used_at, subscriptions);

    return Response.json({
      plan: access.plan,
      status: access.status,
      billingPeriod: selected?.billing_period || null,
      provider: selected?.provider || null,
      currentPeriodEnd: access.currentPeriodEnd,
      renewsAt: access.hasPaidAccess && !selected?.cancel_at_period_end
        ? access.currentPeriodEnd
        : null,
      cancelAtPeriodEnd: selected?.cancel_at_period_end === true,
      trialStartedAt: selected?.trial_started_at || null,
      trialEndDate: selected?.trial_end_date || null,
      trialUsedAt: selected?.trial_used_at || null,
      trialEligible: eligibility.eligible,
      trialEligibilityReason: eligibility.reason,
      grandfathered: selected?.grandfathered === true,
      grandfatheredFromPlan: selected?.grandfathered_from_plan || null,
      entitlements: access.entitlements,
      limits: access.limits,
      hasPaidAccess: access.hasPaidAccess,
      hasAccess: access.hasPaidAccess,
      hasPending,
      isTrialing: access.status === 'trialing',
    });
  } catch (error) {
    console.error('Check subscription error:', error);
    const message = error instanceof Error ? error.message : 'Unable to check subscription';
    return Response.json({ error: message }, { status: 500 });
  }
});