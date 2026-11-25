import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

const PAGE_SIZE = 500;

async function aggregateUsers(entities: any) {
  let totalUsers = 0;
  const onboarding = {
    incomplete: 0,
    missingFlag: 0,
    reminderRecorded: 0,
    awaitingReminder: 0,
  };
  const now = Date.now();
  const reminderCutoff = now - 24 * 60 * 60 * 1000;
  const recentlySeenUserIds = new Set<string>();
  const seenSince = now - 30 * 24 * 60 * 60 * 1000;
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const page = await entities.User.filter({}, '-created_date', PAGE_SIZE, skip);
    totalUsers += page.length;
    for (const account of page) {
      if (account.onboarding_completed !== true && account.role !== 'admin' && !account.is_banned) {
        onboarding.incomplete += 1;
        if (account.reengagement_sent_at) onboarding.reminderRecorded += 1;
        if (account.onboarding_completed == null) onboarding.missingFlag += 1;
        if (account.email && !account.reengagement_sent_at &&
            Date.parse(account.created_date) < reminderCutoff &&
            !(Date.parse(account.timeout_until) > now)) {
          onboarding.awaitingReminder += 1;
        }
      }
      if (account.id && Date.parse(account.last_seen) >= seenSince) recentlySeenUserIds.add(account.id);
    }
    if (page.length < PAGE_SIZE) return { totalUsers, onboarding, recentlySeenUserIds };
  }
}

async function aggregateSubscriptions(entities: any) {
  const counts = {
    totalSubscriptions: 0,
    activeSubscriptions: 0,
    activePayPalRecords: 0,
    activeManualRecords: 0,
    activeOtherRecords: 0,
    trialSubscriptions: 0,
    pendingSubscriptions: 0,
    pendingPayPalAttempts: 0,
    pendingStripeAttempts: 0,
    pendingLegacyAttempts: 0,
    pendingAccounts: 0,
    canceledSubscriptions: 0,
    premiumSubscriptions: 0,
    premiumPlusSubscriptions: 0,
  };
  const activeUserIds = new Set<string>();
  const pendingUserIds = new Set<string>();
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const page = await entities.Subscription.filter({}, '-created_date', PAGE_SIZE, skip);
    counts.totalSubscriptions += page.length;
    for (const subscription of page) {
      if (subscription.status === 'active') {
        counts.activeSubscriptions += 1;
        if (typeof subscription.user_id === "string" && subscription.user_id) activeUserIds.add(subscription.user_id);
        if (subscription.provider === 'paypal') counts.activePayPalRecords += 1;
        else if (subscription.provider === 'manual') counts.activeManualRecords += 1;
        else counts.activeOtherRecords += 1;
      }
      if (subscription.status === 'trial' || subscription.status === 'trialing') {
        counts.trialSubscriptions += 1;
      }
      if (subscription.status === 'pending') {
        counts.pendingSubscriptions += 1;
        if (subscription.provider === 'paypal') counts.pendingPayPalAttempts += 1;
        if (subscription.provider === 'stripe') counts.pendingStripeAttempts += 1;
        if (!subscription.provider) counts.pendingLegacyAttempts += 1;
        if (typeof subscription.user_id === 'string') pendingUserIds.add(subscription.user_id);
        counts.pendingAccounts = pendingUserIds.size;
      }
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
    if (page.length < PAGE_SIZE) return { counts, activeUserIds };
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
    const [users, subscriptions] = await Promise.all([
      aggregateUsers(base44.asServiceRole.entities),
      aggregateSubscriptions(base44.asServiceRole.entities),
    ]);

    return Response.json({
      success: true,
      adminUserId: user.id,
      stats: {
        totalUsers: users.totalUsers,
        incompleteOnboardingAccounts: users.onboarding.incomplete,
        onboardingMissingFlag: users.onboarding.missingFlag,
        onboardingReminderRecorded: users.onboarding.reminderRecorded,
        onboardingAwaitingReminder: users.onboarding.awaitingReminder,
        ...subscriptions.counts,
        activeSubscriberAccounts: subscriptions.activeUserIds.size,
        activeSubscriberAccountsSeen30d: [...subscriptions.activeUserIds].filter(id => users.recentlySeenUserIds.has(id)).length,
      },
    });
  } catch (error) {
    console.error('getAdminDashboardStats error:', error);
    return Response.json({ error: 'Unable to load admin dashboard stats' }, { status: 500 });
  }
});
