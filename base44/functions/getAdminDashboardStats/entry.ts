import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Forbidden: Login required' }, { status: 403 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin role required' }, { status: 403 });
    }

    // Aggregate only. The admin dashboard does not need raw user emails, IDs,
    // purchase rows, or subscription records to render its health metrics.
    const subscriptions = await base44.asServiceRole.entities.Subscription.filter({});
    const users = await base44.asServiceRole.entities.User.filter({});

    const activeSubscriptions = subscriptions.filter((s) => s.status === 'active').length;
    const trialSubscriptions = subscriptions.filter(
      (s) => s.status === 'trial' || s.status === 'trialing',
    ).length;
    const pendingSubscriptions = subscriptions.filter((s) => s.status === 'pending').length;
    const canceledSubscriptions = subscriptions.filter(
      (s) => s.status === 'canceled' || s.status === 'ended',
    ).length;
    const premiumSubscriptions = subscriptions.filter(
      (s) => s.status === 'active' && s.plan === 'premium',
    ).length;
    const premiumPlusSubscriptions = subscriptions.filter(
      (s) => s.status === 'active'
        && (s.plan === 'premium_plus' || s.plan === 'pro' || s.plan === 'pro_filesharing'),
    ).length;

    return Response.json({
      stats: {
        totalUsers: users.length,
        totalSubscriptions: subscriptions.length,
        activeSubscriptions,
        trialSubscriptions,
        pendingSubscriptions,
        canceledSubscriptions,
        premiumSubscriptions,
        premiumPlusSubscriptions,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
