import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
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
    if (user?.id) {
      const rate = await consumeHourlyLimit(
        base44.asServiceRole.entities,
        user.id,
        'follow_up_reminder_mutation',
        120,
      );
      if (!rate.allowed) {
        return Response.json(
          { error: 'Follow-up reminder rate limit exceeded. Please try again later.' },
          { status: 429 },
        );
      }
    }
    const { source_message_id, remind_at, client_request_key } = await readJsonBodyLimited(req, 16 * 1024);
    const result = await createFollowUpReminder({
      entities: base44.asServiceRole.entities,
      user,
      sourceMessageId: source_message_id,
      remindAt: remind_at,
      requestKey: client_request_key,
    });
    return Response.json({
      success: true,
      action: 'create_reminder',
      userId: user?.id || null,
      sourceMessageId: source_message_id,
      requestKey: client_request_key,
      ...result,
    });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('createFollowUpReminder error:', error);
    return followUpReminderErrorResponse(error);
  }
});
