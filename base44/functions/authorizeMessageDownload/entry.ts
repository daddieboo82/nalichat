import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { isBase44EntityId } from '../../shared/workflowEvents.ts';
import { requireEntitlement } from '../../shared/entitlementAccess.ts';
import { isTrustedStoredMediaUrl } from '../../shared/mediaSecurity.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { isConversationId } from '../../shared/conversationIds.ts';
import {
  acquireConversationMembershipLock,
  releaseConversationMembershipLock,
} from '../../shared/conversationMembershipLock.ts';

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

    const downloadRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'message_download_authorization',
      600,
    );
    if (!downloadRate.allowed) {
      return Response.json({ error: 'Download authorization rate limit exceeded.' }, { status: 429 });
    }

    const { messageId } = await readJsonBodyLimited(req, 8 * 1024);
    if (!isBase44EntityId(messageId)) return Response.json({ error: 'Valid messageId is required' }, { status: 400 });

    const entities = base44.asServiceRole.entities;
    const messagePreview = await entities.Message.get(messageId).catch(() => null);
    if (!messagePreview) return Response.json({ error: 'Message not found' }, { status: 404 });
    if (!isConversationId(messagePreview.conversation_id)) {
      return Response.json({ error: 'Message has an invalid conversation reference' }, { status: 409 });
    }

    // Cached message participant_ids are a convenience projection, not the
    // authority for private attachment access. Serialize with conversation
    // membership changes and authorize against the current Conversation row.
    const conversationLockId = await acquireConversationMembershipLock(
      entities,
      messagePreview.conversation_id,
    );
    if (!conversationLockId) {
      return Response.json({ error: 'Conversation is being updated. Please retry.' }, { status: 409 });
    }

    try {
      const [conversation, message] = await Promise.all([
        entities.Conversation.get(messagePreview.conversation_id).catch(() => null),
        entities.Message.get(messageId).catch(() => null),
      ]);
      if (!conversation || !message) {
        return Response.json({ error: 'Message not found' }, { status: 404 });
      }
      if (message.conversation_id !== conversation.id) {
        return Response.json({ error: 'Message conversation changed. Please retry.' }, { status: 409 });
      }
      const participantIds = Array.isArray(conversation.participant_ids)
        ? conversation.participant_ids
        : [];
      if (!participantIds.includes(user.id)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }

      const isSender = message.sender_id === user.id;
      if (!isSender) {
        const { allowed } = await requireEntitlement(
          entities,
          user.id,
          'chat.export',
        );
        if (!allowed) {
          return Response.json({ error: 'Download entitlement required' }, { status: 403 });
        }
      }

      if (!message.file_url) return Response.json({ error: 'Message has no downloadable media' }, { status: 400 });
      if (!isTrustedStoredMediaUrl(message.file_url)) {
        return Response.json({ error: 'Stored message media host is not allowed' }, { status: 400 });
      }
      return Response.json({
        success: true,
        file_url: message.file_url,
        file_name: message.file_name || 'file',
      });
    } finally {
      await releaseConversationMembershipLock(entities, conversationLockId);
    }
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('authorizeMessageDownload error:', error);
    return Response.json({ error: 'Could not authorize download' }, { status: 500 });
  }
});
