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

    if (subs.length === 0) {
      // User has no subscription - return free plan
      return Response.json({
        plan: 'free',
        status: 'active',
        trialActive: false,
      });
    }

    const sub = subs[0];
    const now = new Date();
    const trialEndDate = sub.trial_end_date ? new Date(sub.trial_end_date) : null;
    const trialActive = trialEndDate && now < trialEndDate;

    return Response.json({
      id: sub.id,
      plan: sub.plan,
      status: sub.status,
      trialActive: !!trialActive,
      trialEndsAt: trialEndDate?.toISOString(),
    });
  } catch (error) {
    console.error('Check subscription error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});