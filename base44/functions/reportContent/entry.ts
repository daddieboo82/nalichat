import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { isBase44EntityId } from '../../shared/workflowEvents.ts';
import {
  acquireMessageMutationLock,
  releaseMessageMutationLock,
} from '../../shared/messageMutationLock.ts';
import {
  acquireArtPostEngagementLock,
  releaseArtPostEngagementLock,
} from '../../shared/artPostEngagementLock.ts';
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
    const reporter = await base44.auth.me();
    if (!reporter) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (reporter.is_banned) {
      return Response.json({ error: 'banned' }, { status: 403 });
    }
    if (reporter.timeout_until && new Date(reporter.timeout_until).getTime() > Date.now()) {
      return Response.json(
        { error: 'timed_out', timeout_until: reporter.timeout_until },
        { status: 403 },
      );
    }

    const { content_type, content_id, reason } = await readJsonBodyLimited(req, 16 * 1024);
    const normalizedContentId = typeof content_id === 'string' ? content_id.trim() : '';
    if (!content_type || !isBase44EntityId(normalizedContentId)) {
      return Response.json({ error: 'Valid content_type and content_id are required' }, { status: 400 });
    }
    if (!['message', 'art_post'].includes(content_type)) {
      return Response.json({ error: 'Unsupported content_type' }, { status: 400 });
    }

    const validReasons = ['spam', 'harassment', 'hate_speech', 'violence', 'sexual_content', 'illegal_activity', 'misinformation', 'other'];
    const reportReason = validReasons.includes(reason) ? reason : 'other';
    const categoryMap: Record<string, string> = {
      spam: 'bullying',
      harassment: 'bullying',
      hate_speech: 'racism',
      violence: 'violence',
      sexual_content: 'sexual_violence',
      illegal_activity: 'illegal_activity',
      misinformation: 'bullying',
      other: 'bullying',
    };

    const entities = base44.asServiceRole.entities;
    const rate = await consumeHourlyLimit(entities, reporter.id, 'content_report', 30);
    if (!rate.allowed) {
      return Response.json({ error: 'Report rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    // Pre-authorize before taking shared locks so unauthorized callers cannot
    // create lock contention. For messages, current Conversation membership is
    // authoritative; Message.participant_ids is only a cached projection.
    let messageConversationId: string | null = null;
    if (content_type === 'message') {
      const preview = await entities.Message.get(normalizedContentId).catch(() => null);
      if (!preview) return Response.json({ error: 'Content not found' }, { status: 404 });
      messageConversationId = typeof preview.conversation_id === 'string'
        ? preview.conversation_id
        : null;
      if (!messageConversationId) {
        return Response.json({ error: 'Message has no conversation' }, { status: 409 });
      }
      const conversationPreview = await entities.Conversation
        .get(messageConversationId)
        .catch(() => null);
      const previewParticipants = Array.isArray(conversationPreview?.participant_ids)
        ? conversationPreview.participant_ids
        : [];
      if (!conversationPreview || !previewParticipants.includes(reporter.id)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (preview.sender_id === reporter.id) {
        return Response.json({ error: 'You cannot report your own content' }, { status: 400 });
      }
    } else {
      const preview = await entities.ArtPost.get(normalizedContentId).catch(() => null);
      if (!preview) return Response.json({ error: 'Content not found' }, { status: 404 });
      if (preview.creator_id === reporter.id) {
        return Response.json({ error: 'You cannot report your own content' }, { status: 400 });
      }
    }

    let conversationLockId: string | null = null;
    let messageLockId: string | null = null;
    let artPostLockId: string | null = null;
    if (content_type === 'message') {
      conversationLockId = await acquireConversationMembershipLock(entities, messageConversationId);
      if (!conversationLockId) {
        return Response.json({ error: 'Conversation is being updated. Please retry.' }, { status: 409 });
      }
      messageLockId = await acquireMessageMutationLock(entities, normalizedContentId);
      if (!messageLockId) {
        await releaseConversationMembershipLock(entities, conversationLockId);
        return Response.json({ error: 'Message is being updated. Please retry.' }, { status: 409 });
      }
    } else {
      artPostLockId = await acquireArtPostEngagementLock(entities, normalizedContentId);
      if (!artPostLockId) {
        return Response.json({ error: 'Post is being updated. Please retry.' }, { status: 409 });
      }
    }

    try {
      let reportedUserId = '';
      let reportedUserName = '';
      let authoritativeText = '';
      let authoritativeConversationId = null;

      if (content_type === 'message') {
        const [message, conversation] = await Promise.all([
          entities.Message.get(normalizedContentId).catch(() => null),
          messageConversationId
            ? entities.Conversation.get(messageConversationId).catch(() => null)
            : Promise.resolve(null),
        ]);
        if (!message || !conversation) {
          return Response.json({ error: 'Content not found' }, { status: 404 });
        }
        if (message.conversation_id !== conversation.id) {
          return Response.json({ error: 'Message conversation changed. Please retry.' }, { status: 409 });
        }
        const participantIds = Array.isArray(conversation.participant_ids)
          ? conversation.participant_ids
          : [];
        if (!participantIds.includes(reporter.id)) {
          return Response.json({ error: 'Forbidden' }, { status: 403 });
        }
        reportedUserId = message.sender_id || '';
        reportedUserName = message.sender_name || '';
        authoritativeText = message.text || message.file_name || '';
        authoritativeConversationId = conversation.id;
      } else {
        const post = await entities.ArtPost.get(normalizedContentId).catch(() => null);
        if (!post) return Response.json({ error: 'Content not found' }, { status: 404 });
        reportedUserId = post.creator_id || '';
        reportedUserName = post.creator_name || '';
        authoritativeText = post.title || post.description || '';
      }

      if (!reportedUserId) {
        return Response.json({ error: 'Reported content has no owner' }, { status: 400 });
      }
      if (reportedUserId === reporter.id) {
        return Response.json({ error: 'You cannot report your own content' }, { status: 400 });
      }

      // The content lock makes the pending-check + create sequence atomic for
      // this target, preventing simultaneous requests from creating duplicates.
      const existing = await entities.Violation.filter({
        reported_by_id: reporter.id,
        content_type,
        content_id: normalizedContentId,
        review_status: 'pending',
      });
      if (existing.length > 0) {
        return Response.json({ success: true, action: 'report', userId: reporter.id, contentType: content_type, contentId: normalizedContentId, duplicate: true });
      }

      await entities.Violation.create({
        user_id: reportedUserId,
        user_name: reportedUserName || 'Unknown user',
        reported_by_id: reporter.id,
        reported_by_name: reporter.display_name || reporter.full_name || 'Reporter',
        content_type,
        content_id: normalizedContentId,
        category: categoryMap[reportReason] || 'bullying',
        severity: 'low',
        content: `[USER REPORT — ${reportReason}]\nContent type: ${content_type}\nContent ID: ${normalizedContentId}\n\n${authoritativeText.slice(0, 800)}`,
        conversation_id: authoritativeConversationId,
        message_id: content_type === 'message' ? normalizedContentId : null,
        action_taken: 'warning',
        review_status: 'pending',
        explanation: `Reported by user for: ${reportReason}. Awaiting admin review.`,
      });

      return Response.json({ success: true, action: 'report', userId: reporter.id, contentType: content_type, contentId: normalizedContentId, message: 'Content reported. Thank you.' });
    } finally {
      await releaseArtPostEngagementLock(entities, artPostLockId);
      await releaseMessageMutationLock(entities, messageLockId);
      await releaseConversationMembershipLock(entities, conversationLockId);
    }
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('reportContent error:', error);
    return Response.json({ error: 'Report failed' }, { status: 500 });
  }
});
