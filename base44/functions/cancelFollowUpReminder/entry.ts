import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
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
    const { reminder_id } = await readJsonBodyLimited(req, 8 * 1024);
    const reminder = await cancelFollowUpReminder({
      entities: base44.asServiceRole.entities,
      user,
      reminderId: reminder_id,
    });
    return Response.json({
      success: true,
      action: 'cancel_reminder',
      userId: user?.id || null,
      reminderId: reminder?.id || reminder_id,
      reminder,
    });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('cancelFollowUpReminder error:', error);
    return followUpReminderErrorResponse(error);
  }
});
