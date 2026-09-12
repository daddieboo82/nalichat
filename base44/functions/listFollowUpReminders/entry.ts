import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import {
  followUpReminderErrorResponse,
  listFollowUpReminders,
} from '../../shared/followUpReminders.ts';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const reminders = await listFollowUpReminders({
      entities: base44.asServiceRole.entities,
      user,
    });
    return Response.json({ reminders });
  } catch (error) {
    console.error('listFollowUpReminders error:', error);
    return followUpReminderErrorResponse(error);
  }
});
