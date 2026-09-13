import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';

const SCHEDULE_TIME_ZONE = 'America/New_York';
const SCHEDULE_WINDOW_MINUTE = 20;
const SCHEDULE_KEY_SHA256 = 'f94d780f232eda8b165c78468a5eea82633fa4bc5fd5c948f8c4b97b577f2369';

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

async function listAllRows(
  entity: any,
  query: Record<string, unknown>,
  sort: string,
  pageSize = 200,
) {
  const rows: any[] = [];
  for (let skip = 0; ; skip += pageSize) {
    const page = await entity.filter(query, sort, pageSize, skip);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
function isScheduledHealthCheckWindow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SCHEDULE_TIME_ZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return values.weekday === 'Sun'
    && Number(values.hour) === 4
    && Number(values.minute) <= SCHEDULE_WINDOW_MINUTE;
}

// Weekly app health & enhancement scan run by Nali.
// Scans app data for issues (broken/incomplete records, stale content) and
// surfaces improvement opportunities, then notifies all admins via in-app
// notification + email. Triggered by a scheduled automation (Sundays 4am ET).
Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const body = await readJsonBodyLimited(req, 8 * 1024);

    // Manual runs require an authenticated admin. Scheduled workflow runs do
    // not carry a user identity, so only permit those during the configured
    // Sunday 4am Eastern window and give the scheduler a single hourly claim.
    const caller = await base44.auth.me().catch(() => null);
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
        'admin_health_check',
        4,
      );
      if (!adminRate.allowed) {
        return Response.json({ error: 'Admin operation rate limit exceeded. Please try again later.' }, { status: 429 });
      }
    } else {
      if (!(await validScheduleKey(body?.workflow_key))) {
        return Response.json({ error: 'Forbidden: invalid scheduler credential' }, { status: 403 });
      }
      if (!isScheduledHealthCheckWindow()) {
        return Response.json({ error: 'Forbidden: scheduled health-check window required' }, { status: 403 });
      }
      const scheduledRate = await consumeHourlyLimit(
        base44.asServiceRole.entities,
        'nali-health-scheduler',
        'scheduled_health_check',
        1,
      );
      if (!scheduledRate.allowed) {
        return Response.json({ error: 'Scheduled health check already claimed for this hour.' }, { status: 429 });
      }
    }

    // --- Gather a lightweight snapshot of app data ---
    const [artPosts, projects, tracks, sharedFiles, subscriptions, users, admins] = await Promise.all([
      base44.asServiceRole.entities.ArtPost.list('-created_date', 200),
      base44.asServiceRole.entities.Project.list('-created_date', 200),
      base44.asServiceRole.entities.Track.list('-created_date', 200),
      base44.asServiceRole.entities.SharedFile.list('-created_date', 200),
      base44.asServiceRole.entities.Subscription.list('-created_date', 200),
      base44.asServiceRole.entities.User.list('-created_date', 200),
      listAllRows(
        base44.asServiceRole.entities.User,
        { role: 'admin' },
        '-created_date',
      ),
    ]);

    const snapshotTruncated = {
      artPosts: artPosts.length >= 200,
      projects: projects.length >= 200,
      tracks: tracks.length >= 200,
      sharedFiles: sharedFiles.length >= 200,
      subscriptions: subscriptions.length >= 200,
      users: users.length >= 200,
    };
    const partialSnapshot = Object.values(snapshotTruncated).some(Boolean);

    // --- Detect concrete data issues ---
    const issues = [];

    const brokenPosts = artPosts.filter(p => !p.file_url && !p.image_url);
    if (brokenPosts.length) issues.push(`${brokenPosts.length} ArtPost(s) have no audio or image attached.`);

    const orphanTracks = tracks.filter(t => !t.file_url);
    if (orphanTracks.length) issues.push(`${orphanTracks.length} Track(s) are missing an audio file_url.`);

    const untitledProjects = projects.filter(p => !p.title || !p.title.trim());
    if (untitledProjects.length) issues.push(`${untitledProjects.length} Project(s) have no title.`);

    const filesNoUrl = sharedFiles.filter(f => !f.file_url);
    if (filesNoUrl.length) issues.push(`${filesNoUrl.length} SharedFile(s) are missing a file_url.`);

    // Subscriptions whose trial has already ended but still have a trial status
    const now = Date.now();
    const staleTrials = subscriptions.filter(s =>
      (s.status === 'trial' || s.status === 'trialing')
        && s.trial_end_date
        && new Date(s.trial_end_date).getTime() < now
    );
    if (staleTrials.length) issues.push(`${staleTrials.length} Subscription(s) still have a trial status but the trial end date has passed.`);

    const usersNoOnboarding = users.filter(u => !u.onboarding_completed);
    if (usersNoOnboarding.length) issues.push(`${usersNoOnboarding.length} user(s) have not completed onboarding.`);

    // --- Ask Nali (LLM) to summarize issues + suggest enhancements ---
    const dataSummary = `
App data snapshot (most recent records):
- Users: ${users.length}
- ArtPosts: ${artPosts.length}
- Projects: ${projects.length}
- Tracks: ${tracks.length}
- SharedFiles: ${sharedFiles.length}
- Subscriptions: ${subscriptions.length}

Detected data issues:
${issues.length ? issues.map(i => `- ${i}`).join('\n') : '- None detected'}
`.trim();

    const llmResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are Nali, the AI assistant for NaliChat (a music collaboration app). This is your weekly app health report for the app owner. Based on the data snapshot below, write a concise, friendly report that:
1. Summarizes any concrete issues that need fixing (use the detected issues).
2. Suggests 2-4 practical enhancements or things worth keeping an eye on, based on usage patterns.
Keep it short, scannable, and actionable. Address the owner directly.

${dataSummary}`,
      response_json_schema: {
        type: 'object',
        properties: {
          headline: { type: 'string', description: 'One-line summary of app health' },
          report: { type: 'string', description: 'The full markdown report body' },
          needs_attention: { type: 'boolean', description: 'True if there are issues that need fixing' },
        },
        required: ['headline', 'report', 'needs_attention'],
      },
    });

    const headline = llmResult?.headline || 'Weekly app health check complete';
    const report = llmResult?.report || dataSummary;
    const needsAttention = !!llmResult?.needs_attention || issues.length > 0;

    // --- Notify admins without requiring a full user-table scan ---
    await Promise.all(
      admins.map(admin =>
        base44.asServiceRole.entities.Notification.create({
          recipient_id: admin.id,
          type: 'comment',
          actor_id: 'nali-system',
          actor_name: 'Nali',
          actor_avatar: null,
          message: `Weekly health check: ${headline}`,
          link: '/',
          read: false,
        })
      )
    );

    // Email each admin the full report
    await Promise.all(
      admins.filter(a => a.email).map(admin =>
        base44.asServiceRole.integrations.Core.SendEmail({
          from_name: 'Nali',
          to: admin.email,
          subject: `🎧 NaliChat Weekly Health Check — ${headline}`,
          body: report,
        })
      )
    );

    console.log(`Nali health check done. Issues: ${issues.length}, admins notified: ${admins.length}`);
    return Response.json({ ok: true, headline, needsAttention, issuesCount: issues.length, adminsNotified: admins.length });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('naliHealthCheck error:', error);
    return Response.json({ error: 'Health check failed' }, { status: 500 });
  }
});