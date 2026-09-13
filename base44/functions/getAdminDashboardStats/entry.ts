import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

const PAGE_SIZE = 500;

async function countUsers(entities: any): Promise<number> {
  let total = 0;
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const page = await entities.User.filter({}, '-created_date', PAGE_SIZE, skip);
    total += page.length;
    if (page.length < PAGE_SIZE) return total;
  }
}

async function aggregateSubscriptions(entities: any) {
  const counts = {
    totalSubscriptions: 0,
    activeSubscriptions: 0,
    trialSubscriptions: 0,
    pendingSubscriptions: 0,
    canceledSubscriptions: 0,
    premiumSubscriptions: 0,
    premiumPlusSubscriptions: 0,
  };
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const page = await entities.Subscription.filter({}, '-created_date', PAGE_SIZE, skip);
    counts.totalSubscriptions += page.length;
    for (const subscription of page) {
      if (subscription.status === 'active') counts.activeSubscriptions += 1;
      if (subscription.status === 'trial' || subscription.status === 'trialing') {
        counts.trialSubscriptions += 1;
      }
      if (subscription.status === 'pending') counts.pendingSubscriptions += 1;
      if (subscription.status === 'canceled' || subscription.status === 'ended') {
        counts.canceledSubscriptions += 1;
      }
      if (subscription.status === 'active' && subscription.plan === 'premium') {
        counts.premiumSubscriptions += 1;
      }
      if (
        subscription.status === 'active'
        && ['premium_plus', 'pro', 'pro_filesharing'].includes(subscription.plan)
      ) {
        counts.premiumPlusSubscriptions += 1;
      }
    }
    if (page.length < PAGE_SIZE) return counts;
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Forbidden: Login required' }, { status: 403 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin role required' }, { status: 403 });
    }
    if (user.is_banned) return Response.json({ error: 'banned' }, { status: 403 });
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const statsRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'admin_dashboard_stats',
      60,
    );
    if (!statsRate.allowed) {
      return Response.json({ error: 'Admin operation rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    // Aggregate only. The admin dashboard does not need raw user emails, IDs,
    // purchase rows, or subscription records to render its health metrics.
    const [totalUsers, subscriptionStats] = await Promise.all([
      countUsers(base44.asServiceRole.entities),
      aggregateSubscriptions(base44.asServiceRole.entities),
    ]);

    return Response.json({
      success: true,
      adminUserId: user.id,
      stats: {
        totalUsers,
        ...subscriptionStats,
      },
    });
  } catch (error) {
    console.error('getAdminDashboardStats error:', error);
    return Response.json({ error: 'Unable to load admin dashboard stats' }, { status: 500 });
  }
});
