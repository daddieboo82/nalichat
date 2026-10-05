import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { APP_BASE_URL } from '../../shared/appConfig.ts';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';

const SCHEDULE_WINDOW_MINUTE = 20;
const SCHEDULE_KEY_SHA256 = '1c0592a86691a6c3d1ef4f0d28ec5819076207c2ae56400e5e05c9687e594265';
const INACTIVE_THRESHOLD_DAYS = 14;

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
  return now.getUTCHours() === 17 && now.getUTCMinutes() <= SCHEDULE_WINDOW_MINUTE;
}

// Re-engages users who completed onboarding but haven't been active in two weeks.
// Sends a friendly follow-up email with a direct link back to the app.
// Tracks delivery via `inactive_reengagement_sent_at` so each user gets at most one email.
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
    // 17:00 UTC window and grant the scheduler one claim for the hour.
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
        'admin_inactive_reengagement',
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
        'nali-inactive-reengagement-scheduler',
        'scheduled_inactive_reengagement',
        1,
      );
      if (!scheduledRate.allowed) {
        return Response.json({ error: 'Scheduled re-engagement already claimed for this hour.' }, { status: 429 });
      }
    }

    const appUrl = APP_BASE_URL;
    if (!appUrl) {
      return Response.json(
        { error: 'Server is not configured with an app URL' },
        { status: 500 }
      );
    }

    const homeLink = `${appUrl}/`;
    const s = base44.asServiceRole.entities;

    const twoWeeksAgo = new Date(Date.now() - INACTIVE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const MAX_REENGAGEMENTS_PER_RUN = 500;

    // Find users who finished onboarding, haven't already been sent an inactive
    // follow-up, and whose last presence heartbeat is older than two weeks
    // (or was never recorded, meaning they never came back after onboarding).
    const inactive = await s.User.filter(
      {
        onboarding_completed: true,
        inactive_reengagement_sent_at: null,
        is_banned: { $ne: true },
        $or: [
          { last_seen: { $lt: twoWeeksAgo } },
          { last_seen: null },
          { last_seen: { $exists: false } },
        ],
      },
      'created_date',
      MAX_REENGAGEMENTS_PER_RUN,
    );

    const errors = [];
    let sent = 0;

    for (const user of inactive) {
      try {
        const displayName = user.display_name || user.full_name || 'there';
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: user.email,
          subject: 'We miss you on NaliBase',
          html: `
            <div style="font-family: 'Inter', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #9d50bb; margin-bottom: 16px;">Hey ${displayName}! 👋</h2>
              <p style="color: #333; line-height: 1.6;">
                It's been a couple of weeks since you last visited NaliBase.
                Your projects, messages, and collaborators are right where you left them.
                Jump back in to pick up where you left off, or explore something new.
              </p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${homeLink}"
                   style="display: inline-block; background: linear-gradient(135deg, #9d50bb, #6f42c1); color: #fff; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px;">
                  Back to NaliBase
                </a>
              </div>
              <p style="color: #888; font-size: 13px; line-height: 1.5;">
                If you're having trouble, just reply to this email and we'll help you out.<br/>
                — The NaliBase Team
              </p>
            </div>
          `,
          text: `Hey ${displayName}! It's been a couple of weeks since you last visited NaliBase. Come back and pick up where you left off: ${homeLink}`,
        });

        // Mark this user as contacted so we don't email them again
        await s.User.update(user.id, { inactive_reengagement_sent_at: new Date().toISOString() });
        sent++;
      } catch (err) {
        console.error(`Failed to re-engage inactive user ${user.id}:`, err);
        errors.push('delivery_failed');
      }
    }

    console.log(`reengageInactiveUsers: ${sent} emails sent, ${errors.length} errors.`);
    return Response.json({
      sent,
      skipped: inactive.length - sent,
      totalInactiveProcessed: inactive.length,
      capped: inactive.length >= MAX_REENGAGEMENTS_PER_RUN,
      errorCount: errors.length,
    });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('reengageInactiveUsers error:', error);
    return Response.json({ error: 'Inactive re-engagement job failed' }, { status: 500 });
  }
}