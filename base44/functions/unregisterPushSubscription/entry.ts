import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

const DELETE_BATCH_SIZE = 200;

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_banned) return Response.json({ error: 'banned' }, { status: 403 });
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const writeRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'push_unregister',
      120,
    );
    if (!writeRate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const body = await readJsonBodyLimited(req, 16 * 1024);
    if (typeof body?.endpoint !== 'string') {
      return Response.json({ error: 'endpoint is required' }, { status: 400 });
    }
    const endpoint = body.endpoint.trim();
    if (!endpoint || endpoint.length > 2048) {
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

    return Response.json({
      success: true,
      action: 'unregister_push',
      userId: user.id,
      endpoint,
      removed,
    });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('unregisterPushSubscription error:', error);
    return Response.json({ error: 'Could not unregister push subscription' }, { status: 500 });
  }
});
