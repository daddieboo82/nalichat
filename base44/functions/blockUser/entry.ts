import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await readJsonBodyLimited(req, 8 * 1024);
    const blockedUserId = typeof body?.user_id === 'string' ? body.user_id.trim() : '';
    if (!blockedUserId || blockedUserId === user.id) return Response.json({ error: 'Valid user_id is required' }, { status: 400 });
    const entities = base44.asServiceRole.entities;
    const target = await entities.User.get(blockedUserId).catch(() => null);
    if (!target?.id) return Response.json({ error: 'User not found' }, { status: 404 });
    const existing = await entities.UserBlock.filter({ blocker_id: user.id, blocked_user_id: blockedUserId }, '-created_date', 1);
    if (!existing.length) await entities.UserBlock.create({ blocker_id: user.id, blocked_user_id: blockedUserId });
    return Response.json({ success: true, action: 'block_user', userId: user.id, blockedUserId });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('blockUser failed:', error);
    return Response.json({ error: 'Could not block user' }, { status: 500 });
  }
});