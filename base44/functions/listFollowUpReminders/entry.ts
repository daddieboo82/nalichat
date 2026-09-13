import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
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
    if (user?.id) {
      const rate = await consumeHourlyLimit(
        base44.asServiceRole.entities,
        user.id,
        'follow_up_reminder_list',
        300,
      );
      if (!rate.allowed) {
        return Response.json(
          { error: 'Follow-up reminder rate limit exceeded. Please try again later.' },
          { status: 429 },
        );
      }
    }
    const reminders = await listFollowUpReminders({
      entities: base44.asServiceRole.entities,
      user,
    });
    return Response.json({
      success: true,
      action: 'list_reminders',
      userId: user?.id || null,
      reminders,
    });
  } catch (error) {
    console.error('listFollowUpReminders error:', error);
    return followUpReminderErrorResponse(error);
  }
});
