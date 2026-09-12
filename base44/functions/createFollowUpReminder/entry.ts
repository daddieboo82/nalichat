import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import {
  createFollowUpReminder,
  followUpReminderErrorResponse,
} from '../../shared/followUpReminders.ts';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const { source_message_id, remind_at, client_request_key } = await req.json();
    const result = await createFollowUpReminder({
      entities: base44.asServiceRole.entities,
      user,
      sourceMessageId: source_message_id,
      remindAt: remind_at,
      requestKey: client_request_key,
    });
    return Response.json(result);
  } catch (error) {
    console.error('createFollowUpReminder error:', error);
    return followUpReminderErrorResponse(error);
  }
});
