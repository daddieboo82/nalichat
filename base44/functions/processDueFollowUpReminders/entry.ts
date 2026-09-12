import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import {
  followUpReminderErrorResponse,
  processDueFollowUpReminders,
} from '../../shared/followUpReminders.ts';
import { claimMinuteWindow } from '../../shared/rateLimit.ts';
import { sendPushToUser } from '../../shared/webPush.ts';

let activeReminderRun: Promise<unknown> | null = null;

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const minuteClaim = await claimMinuteWindow(
      base44.asServiceRole.entities,
      'follow-up-reminder-processor',
    );
    if (!minuteClaim.allowed) {
      return Response.json({ success: true, skipped: 'already_processed_this_minute' });
    }

    if (!activeReminderRun) {
      const entities = base44.asServiceRole.entities;
      const run = processDueFollowUpReminders({
        entities,
        sendPush: (userId, payload) => sendPushToUser(entities, userId, payload),
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
