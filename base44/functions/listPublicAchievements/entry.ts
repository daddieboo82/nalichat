import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { userId } = await readJsonBodyLimited(req, 8 * 1024);
    const targetUserId = String(userId || '').trim();
    if (!targetUserId || targetUserId.length > 256) {
      return Response.json({ error: 'Valid userId is required' }, { status: 400 });
    }

    const readRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'public_achievement_lookup',
      240,
    );
    if (!readRate.allowed) {
      return Response.json(
        { error: 'Achievement lookup rate limit exceeded. Please try again later.' },
        { status: 429 },
      );
    }

    const target = await base44.asServiceRole.entities.User.get(targetUserId).catch(() => null);
    if (
      !target
      || !target.onboarding_completed
      || target.is_banned
      || !String(target.display_name || '').trim()
    ) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    const rows = await base44.asServiceRole.entities.Achievement.filter(
      { user_id: target.id },
      '-created_date',
      500,
    );
    return Response.json({
      achievements: rows.map((a) => ({ key: a.key })),
    });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    return Response.json({ error: error?.message || 'Could not load achievements' }, { status: 500 });
  }
});
