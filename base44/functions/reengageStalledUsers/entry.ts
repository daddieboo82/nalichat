import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';

// Re-engages users who registered but never completed onboarding.
// Sends a friendly reminder email with a direct link to the onboarding page.
// Tracks delivery via `reengagement_sent_at` so each user gets at most one email.
//
// Payload: { } (no args needed)
// Returns: { sent: number, skipped: number, errors: string[] }
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

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

    // Load all users (service role for full visibility)
    const allUsers = await s.User.list();
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000; // only re-engage after 24h

    // Filter: not onboarded + not yet sent a re-engagement email + registered >24h ago
    const stalled = allUsers.filter((u) => {
      if (u.onboarding_completed) return false;
      if (u.reengagement_sent_at) return false;
      const createdMs = u.created_date ? new Date(u.created_date).getTime() : 0;
      return createdMs > 0 && createdMs < oneDayAgo;
    });

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
      totalStalled: stalled.length,
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    console.error('reengageStalledUsers error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}