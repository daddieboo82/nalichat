import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's subscription
    const subs = await base44.asServiceRole.entities.Subscription.filter({
      user_id: user.id,
    });

    const now = new Date();
    const createdDate = new Date(user.created_date);
    const diffHours = (now - createdDate) / (1000 * 60 * 60);
    const hasOneHourFree = diffHours < 1;

    const activeSubs = subs.filter(s => s.status === 'active' || s.status === 'trial');

    if (activeSubs.length === 0) {
      // User has no active subscription - check 1 hour free
      return Response.json({
        plan: 'free',
        status: 'active',
        trialActive: false,
        hasAccess: hasOneHourFree,
      });
    }

    const sub = activeSubs[0];
    const trialEndDate = sub.trial_end_date ? new Date(sub.trial_end_date) : null;
    const trialActive = trialEndDate && now < trialEndDate;

    // For 24-hour trial, if trialEndDate has passed, we don't have access unless status is active and plan is pro
    let hasAccess = false;
    if (sub.plan === 'pro') hasAccess = true;
    if (sub.plan === 'trial') hasAccess = trialActive;
    if (hasOneHourFree) hasAccess = true;

    return Response.json({
      id: sub.id,
      plan: sub.plan,
      status: sub.status,
      trialActive: !!trialActive,
      trialEndsAt: trialEndDate?.toISOString(),
      hasAccess,
    });
  } catch (error) {
    console.error('Check subscription error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});