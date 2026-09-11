import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import {
  followUpReminderErrorResponse,
  processDueFollowUpReminders,
} from '../../shared/followUpReminders.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

let activeReminderRun: Promise<unknown> | null = null;

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const minuteKey = new Date().toISOString().slice(0, 16);
    const minuteClaim = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      `follow-up-reminder-processor:${minuteKey}`,
      'process_due_follow_up_reminders',
      1,
    );
    if (!minuteClaim.allowed) {
      return Response.json({ success: true, skipped: 'already_processed_this_minute' });
    }

    if (!activeReminderRun) {
      const run = processDueFollowUpReminders({
        entities: base44.asServiceRole.entities,
      });
      activeReminderRun = run;
      run.then(
        () => {
          if (activeReminderRun === run) activeReminderRun = null;
        },
        () => {
          if (activeReminderRun === run) activeReminderRun = null;
        },
      );
    }
    const summary = await activeReminderRun;
    return Response.json(summary);
  } catch (error) {
    console.error('processDueFollowUpReminders error:', error);
    return followUpReminderErrorResponse(error);
  }
});
