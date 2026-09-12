import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import {
  followUpReminderErrorResponse,
  rescheduleFollowUpReminder,
} from '../../shared/followUpReminders.ts';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const { reminder_id, remind_at } = await readJsonBodyLimited(req, 8 * 1024);
    const reminder = await rescheduleFollowUpReminder({
      entities: base44.asServiceRole.entities,
      user,
      reminderId: reminder_id,
      remindAt: remind_at,
    });
    return Response.json({ reminder });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('rescheduleFollowUpReminder error:', error);
    return followUpReminderErrorResponse(error);
  }
});
