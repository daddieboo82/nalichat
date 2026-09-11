import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

// Re-engages users who registered but never completed onboarding.
// Sends a friendly reminder email with a direct link to the onboarding page.
// Tracks delivery via `reengagement_sent_at` so each user gets at most one email.
//
// Payload: { } (no args needed)
// Returns: { sent: number, skipped: number, errors: string[] }
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (caller.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin role required' }, { status: 403 });
    }

    const adminRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      caller.id,
      'admin_reengagement',
      4,
    );
    if (!adminRate.allowed) {
      return Response.json({ error: 'Admin operation rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    // App URL for the onboarding link comes only from server configuration.
    const appUrl =
      Deno.env.get('APP_BASE_URL') ||
      Deno.env.get('WIX_CHECKOUT_APP_URL') ||
      'https://nalichat.org';
    if (!appUrl) {
      return Response.json(
        { error: 'Server is not configured with an app URL' },
        { status: 500 }
      );
    }

    const onboardingLink = `${appUrl}/onboarding`;
    const s = base44.asServiceRole.entities;

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const MAX_REENGAGEMENTS_PER_RUN = 500;

    // Query only eligible users and cap one maintenance run so a single trigger
    // cannot fan out into a full user-table read or an unbounded email burst.
    const stalled = await s.User.filter(
      {
        onboarding_completed: false,
        reengagement_sent_at: null,
        created_date: { $lt: oneDayAgo },
      },
      'created_date',
      MAX_REENGAGEMENTS_PER_RUN,
    );

    const errors = [];
    let sent = 0;

    for (const user of stalled) {
      try {
        const displayName = user.display_name || user.full_name || 'there';
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: user.email,
          subject: 'Finish setting up your NaliChat profile',
          html: `
            <div style="font-family: 'Inter', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #9d50bb; margin-bottom: 16px;">Hey ${displayName}! 👋</h2>
              <p style="color: #333; line-height: 1.6;">
                We noticed you haven't finished setting up your NaliChat profile yet.
                It only takes a minute — just add your display name and birthdate to unlock
                the full studio, messaging, and collaboration features.
              </p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${onboardingLink}"
                   style="display: inline-block; background: linear-gradient(135deg, #9d50bb, #6f42c1); color: #fff; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px;">
                  Complete Your Profile
                </a>
              </div>
              <p style="color: #888; font-size: 13px; line-height: 1.5;">
                If you're having trouble, just reply to this email and we'll help you out.<br/>
                — The NaliChat Team
              </p>
            </div>
          `,
          text: `Hey ${displayName}! We noticed you haven't finished setting up your NaliChat profile yet. Complete it here: ${onboardingLink}`,
        });

        // Mark this user as re-engaged so we don't email them again
        await s.User.update(user.id, { reengagement_sent_at: new Date().toISOString() });
        sent++;
      } catch (err) {
        console.error(`Failed to re-engage user ${user.id} (${user.email}):`, err.message);
        errors.push(`${user.email}: ${err.message}`);
      }
    }

    console.log(`reengageStalledUsers: ${sent} emails sent, ${errors.length} errors.`);
    return Response.json({
      sent,
      skipped: stalled.length - sent,
      totalStalledProcessed: stalled.length,
      capped: stalled.length >= MAX_REENGAGEMENTS_PER_RUN,
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    console.error('reengageStalledUsers error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}