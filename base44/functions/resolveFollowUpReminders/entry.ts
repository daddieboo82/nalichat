import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import {
  followUpReminderErrorResponse,
  messageIdFromEntityEvent,
  resolveFollowUpRemindersForMessage,
} from '../../shared/followUpReminders.ts';
import { workflowRecordIsFresh } from '../../shared/workflowEvents.ts';
import { claimFixedWindow } from '../../shared/rateLimit.ts';
import { validWorkflowKey } from '../../shared/workflowAuth.ts';

const WORKFLOW_KEY_SHA256 = '12a50aaf8f80cfa38533646a950c347d5bd149b43d8e4e15219ebfeae333d3dc';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }
    const base44 = createClientFromRequest(req);
    const { event, data, workflow_key } = await readJsonBodyLimited(req, 64 * 1024);
    if (!(await validWorkflowKey(workflow_key, WORKFLOW_KEY_SHA256))) {
      return Response.json({ error: 'Forbidden: invalid workflow credential' }, { status: 403 });
    }
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
    const eventClaim = await claimFixedWindow(
      base44.asServiceRole.entities,
      `follow-up-resolver:${message.id}`,
      10,
    );
    if (!eventClaim.allowed) {
      return Response.json({ success: true, completed: 0, skipped: 'already_processed' });
    }
    const completed = await resolveFollowUpRemindersForMessage({
      entities: base44.asServiceRole.entities,
      message,
    });
    return Response.json({ success: true, completed });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('resolveFollowUpReminders error:', error);
    return followUpReminderErrorResponse(error);
  }
});
