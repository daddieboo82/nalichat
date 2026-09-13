import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { isOnline } = await readJsonBodyLimited(req, 8 * 1024);
    if (typeof isOnline !== 'boolean') {
      return Response.json({ error: 'isOnline must be a boolean' }, { status: 400 });
    }

    // Moderation should prevent a user from advertising themselves as online,
    // but must never block an authenticated cleanup transition to offline.
    if (isOnline && user.is_banned) {
      return Response.json({ error: 'banned' }, { status: 403 });
    }
    if (
      isOnline
      && user.timeout_until
      && new Date(user.timeout_until).getTime() > Date.now()
    ) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const writeRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'user_presence',
      1800,
    );
    if (!writeRate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    await base44.asServiceRole.entities.User.update(user.id, {
      is_online: isOnline,
      last_seen: new Date().toISOString(),
    });

    return Response.json({ success: true });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('Error updating user presence:', error);
    return Response.json(
      { error: 'Unable to update presence' },
      { status: 500 },
    );
  }
});