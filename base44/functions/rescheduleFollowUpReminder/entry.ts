import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import {
  followUpReminderErrorResponse,
  rescheduleFollowUpReminder,
} from '../../shared/followUpReminders.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const { reminder_id, remind_at } = await req.json();
    const reminder = await rescheduleFollowUpReminder({
      entities: base44.asServiceRole.entities,
      user,
      reminderId: reminder_id,
      remindAt: remind_at,
    });
    return Response.json({ reminder });
  } catch (error) {
    console.error('rescheduleFollowUpReminder error:', error);
    return followUpReminderErrorResponse(error);
  }
});
