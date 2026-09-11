import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

const DELETE_BATCH_SIZE = 200;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const writeRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'push_unregister',
      120,
    );
    if (!writeRate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const endpoint = String(body?.endpoint || '');
    if (!endpoint) {
      return Response.json({ error: 'endpoint is required' }, { status: 400 });
    }

    const entity = base44.asServiceRole.entities.PushSubscription;
    let removed = 0;
    while (true) {
      const rows = await entity.filter(
        { user_id: user.id, endpoint },
        '-created_date',
        DELETE_BATCH_SIZE,
      );
      if (rows.length === 0) break;
      for (const row of rows) {
        await entity.delete(row.id);
        removed += 1;
      }
      if (rows.length < DELETE_BATCH_SIZE) break;
    }

    return Response.json({ success: true, removed });
  } catch (error) {
    console.error('unregisterPushSubscription error:', error);
    return Response.json({ error: error?.message || 'Could not unregister push subscription' }, { status: 500 });
  }
});
