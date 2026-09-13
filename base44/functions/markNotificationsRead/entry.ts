import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const entities = base44.asServiceRole.entities;
    const rate = await consumeHourlyLimit(
      entities,
      user.id,
      'notification_mark_read',
      120,
    );
    if (!rate.allowed) {
      return Response.json(
        { error: 'Notification update rate limit exceeded. Please try again later.' },
        { status: 429 },
      );
    }

    const result = await entities.Notification.updateMany(
      { recipient_id: user.id },
      { $set: { read: true } },
    );

    return Response.json({
      success: true,
      action: 'mark_notifications_read',
      userId: user.id,
      updated: Number(result?.updated || 0),
    });
  } catch (error) {
    console.error('markNotificationsRead error:', error);
    return Response.json({ error: 'Could not update notifications' }, { status: 500 });
  }
});
