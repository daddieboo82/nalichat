import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import {
  followUpReminderErrorResponse,
  processDueFollowUpReminders,
} from '../../shared/followUpReminders.ts';

let activeReminderRun: Promise<unknown> | null = null;

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
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
