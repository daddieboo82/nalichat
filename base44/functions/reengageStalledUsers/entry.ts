import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { APP_BASE_URL } from '../../shared/appConfig.ts';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';

const SCHEDULE_WINDOW_MINUTE = 20;
const SCHEDULE_KEY_SHA256 = '0383ab24e0c232e3d0064f1656603a9df4e0593f76cf5a25214395700503578e';

async function validScheduleKey(value: unknown) {
  if (typeof value !== 'string' || value.length < 32 || value.length > 256) return false;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  const actual = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  if (actual.length !== SCHEDULE_KEY_SHA256.length) return false;
  let mismatch = 0;
  for (let i = 0; i < actual.length; i += 1) {
    mismatch |= actual.charCodeAt(i) ^ SCHEDULE_KEY_SHA256.charCodeAt(i);
  }
  return mismatch === 0;
}

function isScheduledReengagementWindow(now = new Date()) {
  return now.getUTCHours() === 9 && now.getUTCMinutes() <= SCHEDULE_WINDOW_MINUTE;
}

// Re-engages users who registered but never completed onboarding.
// Sends a friendly reminder email with a direct link to the onboarding page.
// Tracks delivery via `reengagement_sent_at` so each user gets at most one email.
//
// Payload: { } (no args needed)
// Returns: { sent: number, skipped: number, errors: string[] }
export default async function(req) {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const body = await readJsonBodyLimited(req, 8 * 1024);
    const caller = await base44.auth.me().catch(() => null);

    // Manual runs require an authenticated admin. The daily workflow does not
    // carry a user identity, so only allow that path during the configured
    // 09:00 UTC window and grant the scheduler one claim for the hour.
    if (caller) {
      if (caller.role !== 'admin') {
        return Response.json({ error: 'Forbidden: admin role required' }, { status: 403 });
      }
      if (caller.is_banned) {
        return Response.json({ error: 'Forbidden: banned account' }, { status: 403 });
      }
      if (caller.timeout_until && Date.parse(caller.timeout_until) > Date.now()) {
        return Response.json({ error: 'Forbidden: timed out account' }, { status: 403 });
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
    } else {
      if (!(await validScheduleKey(body?.workflow_key))) {
        return Response.json({ error: 'Forbidden: invalid scheduler credential' }, { status: 403 });
      }
      if (!isScheduledReengagementWindow()) {
        return Response.json({ error: 'Forbidden: scheduled re-engagement window required' }, { status: 403 });
      }
      const scheduledRate = await consumeHourlyLimit(
        base44.asServiceRole.entities,
        'nali-reengagement-scheduler',
        'scheduled_reengagement',
        1,
      );
      if (!scheduledRate.allowed) {
        return Response.json({ error: 'Scheduled re-engagement already claimed for this hour.' }, { status: 429 });
      }
    }

    // App URL for the onboarding link comes only from server configuration.
    const appUrl = APP_BASE_URL;
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
        console.error(`Failed to re-engage user ${user.id}:`, err);
        errors.push('delivery_failed');
      }
    }

    console.log(`reengageStalledUsers: ${sent} emails sent, ${errors.length} errors.`);
    return Response.json({
      sent,
      skipped: stalled.length - sent,
      totalStalledProcessed: stalled.length,
      capped: stalled.length >= MAX_REENGAGEMENTS_PER_RUN,
      errorCount: errors.length,
    });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('reengageStalledUsers error:', error);
    return Response.json({ error: 'Re-engagement job failed' }, { status: 500 });
  }
}