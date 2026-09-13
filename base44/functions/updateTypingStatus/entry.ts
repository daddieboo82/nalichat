import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { isBase44EntityId } from '../../shared/workflowEvents.ts';
import { isConversationId } from '../../shared/conversationIds.ts';
import { acquireConversationMembershipLock, releaseConversationMembershipLock } from '../../shared/conversationMembershipLock.ts';

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

    const body = await readJsonBodyLimited(req, 8 * 1024);
    const conversationId = String(body?.conversationId || '').trim();
    const action = String(body?.action || 'heartbeat');
    if (
      !isConversationId(conversationId)
      || !['heartbeat', 'clear'].includes(action)
    ) {
      return Response.json({ error: 'Valid conversationId and action are required' }, { status: 400 });
    }

    const typingRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'typing_status',
      1800,
    );
    if (!typingRate.allowed) {
      return Response.json({ error: 'Typing status rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const entities = base44.asServiceRole.entities;
    const conversationLockId = await acquireConversationMembershipLock(entities, conversationId);
    if (!conversationLockId) {
      return Response.json({ error: 'Conversation is being updated. Please retry.' }, { status: 409 });
    }

    try {
    const conversation = await entities.Conversation.get(conversationId);
    if (!conversation) return Response.json({ error: 'Conversation not found' }, { status: 404 });
    const participantIds = Array.isArray(conversation.participant_ids) ? conversation.participant_ids : [];
    if (!participantIds.includes(user.id)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existing = await entities.TypingStatus.filter(
      {
        conversation_id: conversation.id,
        user_id: user.id,
      },
      '-last_typed_at',
      20,
    );
    const row = existing[0] || null;

    if (action === 'clear') {
      for (const item of existing) await entities.TypingStatus.delete(item.id);
      return Response.json({ success: true, action: 'clear', userId: user.id, conversationId, cleared: existing.length });
    }

    const payload = {
      conversation_id: conversation.id,
      user_id: user.id,
      user_name: user.display_name || user.full_name || 'Someone',
      participant_ids: participantIds,
      last_typed_at: new Date().toISOString(),
    };

    const updated = row
      ? await entities.TypingStatus.update(row.id, payload)
      : await entities.TypingStatus.create(payload);

    // Collapse duplicate legacy rows if they exist.
    for (const duplicate of existing.slice(1)) {
      await entities.TypingStatus.delete(duplicate.id);
    }

    return Response.json({ success: true, action: 'heartbeat', userId: user.id, conversationId, typing: updated });
    } finally {
      await releaseConversationMembershipLock(entities, conversationLockId);
    }
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('updateTypingStatus error:', error);
    return Response.json({ error: 'Typing status update failed' }, { status: 500 });
  }
});
