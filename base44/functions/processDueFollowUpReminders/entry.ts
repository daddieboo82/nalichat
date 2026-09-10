import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import {
  followUpReminderErrorResponse,
  processDueFollowUpReminders,
} from '../../shared/followUpReminders.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const summary = await processDueFollowUpReminders({
      entities: base44.asServiceRole.entities,
    });
    return Response.json(summary);
  } catch (error) {
    console.error('processDueFollowUpReminders error:', error);
    return followUpReminderErrorResponse(error);
  }
});
