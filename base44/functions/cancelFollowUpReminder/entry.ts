import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import {
  cancelFollowUpReminder,
  followUpReminderErrorResponse,
} from '../../shared/followUpReminders.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const { reminder_id } = await req.json();
    const reminder = await cancelFollowUpReminder({
      entities: base44.asServiceRole.entities,
      user,
      reminderId: reminder_id,
    });
    return Response.json({ reminder });
  } catch (error) {
    console.error('cancelFollowUpReminder error:', error);
    return followUpReminderErrorResponse(error);
  }
});
