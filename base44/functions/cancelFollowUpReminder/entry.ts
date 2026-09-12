import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import {
  cancelFollowUpReminder,
  followUpReminderErrorResponse,
} from '../../shared/followUpReminders.ts';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
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
