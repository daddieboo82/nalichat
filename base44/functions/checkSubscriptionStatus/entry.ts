import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Look for subscriptions in the database (kept up to date by the Stripe webhook)
    const subs = await base44.asServiceRole.entities.Subscription.filter({ user_id: user.id });

    const activeSub = subs.find((s: any) => s.status === 'active');
    const pendingSub = subs.find((s: any) => s.status === 'pending');

    if (activeSub) {
      return Response.json({
        plan: activeSub.plan || 'pro',
        status: 'active',
        hasAccess: true,
        hasPending: !!pendingSub,
        currentPeriodEnd: activeSub.current_period_end || null,
      });
    }

    // No active subscription — access stays locked until a recurring plan is active
    return Response.json({
      plan: 'free',
      status: pendingSub ? 'pending' : 'inactive',
      hasAccess: false,
      hasPending: !!pendingSub,
    });
  } catch (error) {
    console.error('Check subscription error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});