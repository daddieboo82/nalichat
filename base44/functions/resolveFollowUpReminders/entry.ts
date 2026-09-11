import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import {
  followUpReminderErrorResponse,
  messageIdFromEntityEvent,
  resolveFollowUpRemindersForMessage,
} from '../../shared/followUpReminders.ts';
import { workflowRecordIsFresh } from '../../shared/workflowEvents.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();
    if (event?.type !== 'create') {
      return Response.json({ success: true, completed: 0 });
    }
    const messageId = messageIdFromEntityEvent({ event, data });
    if (!messageId) {
      return Response.json({ success: true, completed: 0, skipped: 'missing_message_id' });
    }
    const matches = await base44.asServiceRole.entities.Message.filter(
      { id: messageId },
      '-created_date',
      1,
      0,
    );
    const message = matches[0];
    if (!message) {
      return Response.json({ success: true, completed: 0, skipped: 'message_not_found' });
    }
    if (!workflowRecordIsFresh(message, 'create')) {
      return Response.json({ success: true, completed: 0, skipped: 'stale_workflow_record' });
    }
    const completed = await resolveFollowUpRemindersForMessage({
      entities: base44.asServiceRole.entities,
      message,
    });
    return Response.json({ success: true, completed });
  } catch (error) {
    console.error('resolveFollowUpReminders error:', error);
    return followUpReminderErrorResponse(error);
  }
});
