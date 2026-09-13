import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requireEntitlement } from '../../shared/entitlementAccess.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { isTrustedStoredMediaUrl } from '../../shared/mediaSecurity.ts';
import { isBase44EntityId } from '../../shared/workflowEvents.ts';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { isConversationId } from '../../shared/conversationIds.ts';
import {
  acquireConversationMembershipLock,
  releaseConversationMembershipLock,
} from '../../shared/conversationMembershipLock.ts';
import {
  AiQuotaError,
  aiQuotaErrorResponse,
  executeMeteredAiRequest,
} from '../../shared/aiQuota.ts';

const MAX_TRANSCRIBE_BYTES = 50 * 1024 * 1024;

async function storedMediaSize(url: string): Promise<number | null> {
  try {
    const head = await fetch(url, { method: 'HEAD', redirect: 'manual' });
    if (head.ok) {
      const length = Number(head.headers.get('content-length'));
      if (Number.isFinite(length) && length >= 0) return length;
    }
  } catch {}

  try {
    const probe = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      redirect: 'manual',
    });
    if (probe.ok || probe.status === 206) {
      const range = probe.headers.get('content-range') || '';
      const match = range.match(/\/(\d+)$/);
      if (match) return Number(match[1]);
      const length = Number(probe.headers.get('content-length'));
      if (Number.isFinite(length) && length >= 0 && probe.status !== 206) return length;
    }
    try { await probe.body?.cancel(); } catch {}
  } catch {}
  return null;
}

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

    const rate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'voice_transcription',
      60,
    );
    if (!rate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const { messageId, request_key } = await readJsonBodyLimited(req, 8 * 1024);
    if (!isBase44EntityId(messageId)) return Response.json({ error: 'Valid messageId is required' }, { status: 400 });

    const entities = base44.asServiceRole.entities;
    const messagePreview = await entities.Message.get(String(messageId)).catch(() => null);
    if (!messagePreview) return Response.json({ error: 'Message not found' }, { status: 404 });
    if (!isConversationId(messagePreview.conversation_id)) {
      return Response.json({ error: 'Message has an invalid conversation reference' }, { status: 409 });
    }
    if (!messagePreview.file_url || !['audio', 'file'].includes(messagePreview.type)) {
      return Response.json({ error: 'Message has no transcribable audio' }, { status: 400 });
    }
    if (!isTrustedStoredMediaUrl(messagePreview.file_url)) {
      return Response.json({ error: 'Stored audio host is not allowed' }, { status: 400 });
    }

    // Check paid access before any remote storage probe.
    const { allowed } = await requireEntitlement(entities, user.id, 'voice.transcription');
    if (!allowed) {
      return Response.json({ error: 'Premium is required for voice transcription' }, { status: 403 });
    }

    const mediaSize = await storedMediaSize(messagePreview.file_url);
    if (mediaSize === null) {
      return Response.json({ error: 'Could not verify stored audio size' }, { status: 400 });
    }
    if (mediaSize <= 0 || mediaSize > MAX_TRANSCRIBE_BYTES) {
      return Response.json({ error: 'Voice transcription supports audio up to 50MB' }, { status: 413 });
    }

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
        entities.Message.get(String(messageId)).catch(() => null),
      ]);
      if (!conversation || !message) {
        return Response.json({ error: 'Message not found' }, { status: 404 });
      }
      if (
        message.conversation_id !== conversation.id
        || message.file_url !== messagePreview.file_url
        || !['audio', 'file'].includes(message.type)
      ) {
        return Response.json({ error: 'Message audio changed. Please retry.' }, { status: 409 });
      }
      const participantIds = Array.isArray(conversation.participant_ids)
        ? conversation.participant_ids
        : [];
      if (!participantIds.includes(user.id)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { result, quota } = await executeMeteredAiRequest({
        base44,
        user,
        operation: 'voice_transcription',
        requestKey: request_key,
        dispatch: () => base44.asServiceRole.integrations.Core.TranscribeAudio({
          audio_url: message.file_url,
        }),
      });
      const text = typeof result === 'string' ? result : result?.text || result?.data || '';
      return Response.json({ text: String(text || '').trim(), quota });
    } finally {
      await releaseConversationMembershipLock(entities, conversationLockId);
    }
  } catch (error) {
    if (error instanceof AiQuotaError) return aiQuotaErrorResponse(error);
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('transcribeMessageAudio error:', error);
    return Response.json({ error: 'Transcription failed' }, { status: 500 });
  }
});
