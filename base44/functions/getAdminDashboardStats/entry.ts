import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Forbidden: Login required' }, { status: 403 });
    }

    // Security: only admins may access platform-wide stats
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin role required' }, { status: 403 });
    }

    // Return aggregated counts only — never expose raw user/subscription PII
    const subscriptions = await base44.asServiceRole.entities.Subscription.filter({});
    const users = await base44.asServiceRole.entities.User.filter({});

    const activeSubs = subscriptions.filter(s => s.status === 'active').length;
    const trialSubs = subscriptions.filter(s => s.status === 'trial' || s.status === 'trialing').length;
    const canceledSubs = subscriptions.filter(s => s.status === 'canceled' || s.status === 'ended').length;

    return Response.json({
      stats: {
        totalUsers: users.length,
        totalSubscriptions: subscriptions.length,
        activeSubscriptions: activeSubs,
        trialSubscriptions: trialSubs,
        canceledSubscriptions: canceledSubs,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});