import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { isBase44EntityId } from '../../shared/workflowEvents.ts';
import { isConversationId } from '../../shared/conversationIds.ts';
import { acquireConversationMembershipLock, releaseConversationMembershipLock } from '../../shared/conversationMembershipLock.ts';

// Marks a message as read by the current user using the service role
// (bypasses RLS — the sender owns the message, so the reader can't
// update it directly).  Idempotent: adds the user ID only if not already
// present in read_by.
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
    if (user.is_banned) {
      return Response.json({ error: 'banned' }, { status: 403 });
    }
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const { message_id } = await readJsonBodyLimited(req, 64 * 1024);
    const messageId = String(message_id || '').trim();
    if (!isBase44EntityId(messageId)) {
      return Response.json({ error: 'Valid message_id is required' }, { status: 400 });
    }

    const readRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'message_read_receipt',
      1800,
    );
    if (!readRate.allowed) {
      return Response.json({ error: 'Read receipt rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const entities = base44.asServiceRole.entities;
    const message = await entities.Message.get(messageId);
    if (!message) {
      return Response.json({ error: 'Message not found' }, { status: 404 });
    }
    if (!isConversationId(message.conversation_id)) {
      return Response.json({ error: 'Message has an invalid conversation reference' }, { status: 409 });
    }

    const conversationLockId = await acquireConversationMembershipLock(entities, message.conversation_id);
    if (!conversationLockId) {
      return Response.json({ error: 'Conversation is being updated. Please retry.' }, { status: 409 });
    }

    try {
    const conversation = await entities.Conversation.get(message.conversation_id).catch(() => null);
    const participantIds = Array.isArray(conversation?.participant_ids) ? conversation.participant_ids : [];
    if (!conversation || !participantIds.includes(user.id)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Don't mark your own messages as read.
    if (message.sender_id === user.id) {
      return Response.json({ success: true, alreadyRead: true });
    }

    const alreadyRead = Array.isArray(message.read_by) && message.read_by.includes(user.id);
    if (alreadyRead) {
      return Response.json({ success: true, alreadyRead: true });
    }

    await entities.Message.updateMany(
      { id: messageId },
      { $addToSet: { read_by: user.id } },
    );

    return Response.json({ success: true, alreadyRead: false });
    } finally {
      await releaseConversationMembershipLock(entities, conversationLockId);
    }
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('markMessageRead error:', error);
    return Response.json({ error: 'Could not mark message read' }, { status: 500 });
  }
});