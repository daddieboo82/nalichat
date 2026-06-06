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
    const diffDays = (now - createdDate) / (1000 * 60 * 60 * 24);
    const hasTrialFree = diffDays <= 7;
    const isAdmin = user.role === 'admin';

    if (isAdmin) {
      return Response.json({
        plan: 'pro_filesharing',
        status: 'active',
        trialActive: false,
        hasAccess: true,
      });
    }

    const activeSubs = subs.filter(s => s.status === 'active' || s.status === 'trial');

    if (activeSubs.length === 0) {
      // User has no active subscription - check 7 days free
      return Response.json({
        plan: hasTrialFree ? 'trial' : 'free',
        status: 'active',
        trialActive: hasTrialFree,
        hasAccess: hasTrialFree,
        trialEndsAt: hasTrialFree ? new Date(createdDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() : null,
      });
    }

    const sub = activeSubs[0];
    const trialEndDate = sub.trial_end_date ? new Date(sub.trial_end_date) : null;
    const trialActive = trialEndDate && now < trialEndDate;

    // If trialEndDate has passed, we don't have access unless status is active and plan is pro
    let hasAccess = false;
    if (sub.plan === 'pro' || sub.plan === 'pro_filesharing') hasAccess = true;
    if (sub.plan === 'trial') hasAccess = trialActive;
    if (hasTrialFree) hasAccess = true;

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