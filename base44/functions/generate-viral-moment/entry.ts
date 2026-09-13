import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
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

// Generates a viral "moment" from a chat message or voice note — either an
// AI meme (image + caption) or a vertical reel script for TikTok / Instagram.
// All credit-costly integration calls run server-side under asServiceRole.
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

    const { allowed } = await requireEntitlement(
      base44.asServiceRole.entities,
      user.id,
      'ai.standard',
    );
    if (!allowed) {
      return Response.json({ error: 'Premium is required for Viral Moment AI' }, { status: 403 });
    }

    const rate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'ai_viral_moment',
      30,
    );
    if (!rate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const { messageId, type, request_key } = await readJsonBodyLimited(req, 8 * 1024);
    if (!isBase44EntityId(messageId)) {
      return Response.json({ error: 'Valid messageId is required' }, { status: 400 });
    }
    if (type !== 'meme' && type !== 'reel') {
      return Response.json({ error: 'type must be "meme" or "reel"' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const messagePreview = await entities.Message.get(messageId).catch(() => null);
    if (!messagePreview) {
      return Response.json({ error: 'Message not found' }, { status: 404 });
    }
    if (!isConversationId(messagePreview.conversation_id)) {
      return Response.json({ error: 'Message has an invalid conversation reference' }, { status: 409 });
    }

    const senderName = String(messagePreview.sender_name || 'Someone')
      .replace(/[\r\n]/g, ' ')
      .trim()
      .slice(0, 120) || 'Someone';
    const initialMessageText = typeof messagePreview.text === 'string'
      ? messagePreview.text.trim().slice(0, 12000)
      : '';
    const isVoiceNote =
      !initialMessageText &&
      !!messagePreview.file_url &&
      (messagePreview.type === 'audio' || String(messagePreview.file_type || '').startsWith('audio'));

    // Validate plan access before any remote storage probe.
    if (isVoiceNote) {
      const voiceAccess = await requireEntitlement(
        entities,
        user.id,
        'voice.transcription',
      );
      if (!voiceAccess.allowed) {
        return Response.json({ error: 'Voice transcription is not available on your plan' }, { status: 403 });
      }
      if (!isTrustedStoredMediaUrl(messagePreview.file_url)) {
        return Response.json({ error: 'Stored voice-note host is not allowed' }, { status: 400 });
      }
      const mediaSize = await storedMediaSize(messagePreview.file_url);
      if (mediaSize === null) {
        return Response.json({ error: 'Could not verify stored voice-note size' }, { status: 400 });
      }
      if (mediaSize <= 0 || mediaSize > MAX_TRANSCRIBE_BYTES) {
        return Response.json({ error: 'Viral Moment transcription supports voice notes up to 50MB' }, { status: 413 });
      }
    } else if (!initialMessageText) {
      return Response.json({ error: 'Message text or a voice note is required' }, { status: 400 });
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
        entities.Message.get(messageId).catch(() => null),
      ]);
      if (!conversation || !message) {
        return Response.json({ error: 'Message not found' }, { status: 404 });
      }
      const currentParticipantIds = Array.isArray(conversation.participant_ids)
        ? conversation.participant_ids
        : [];
      if (!currentParticipantIds.includes(user.id)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }

      const currentMessageText = typeof message.text === 'string'
        ? message.text.trim().slice(0, 12000)
        : '';
      const currentIsVoiceNote =
        !currentMessageText &&
        !!message.file_url &&
        (message.type === 'audio' || String(message.file_type || '').startsWith('audio'));
      if (
        message.conversation_id !== conversation.id
        || currentMessageText !== initialMessageText
        || currentIsVoiceNote !== isVoiceNote
        || (message.file_url || '') !== (messagePreview.file_url || '')
      ) {
        return Response.json({ error: 'Message content changed. Please retry.' }, { status: 409 });
      }
      const currentFileUrl = message.file_url || '';

    const { result, quota } = await executeMeteredAiRequest({
      base44,
      user,
      operation: type === 'meme' ? 'viral_moment_meme' : 'viral_moment_reel',
      requestKey: request_key,
      dispatch: async () => {
        let finalMessageText = initialMessageText;
        if (isVoiceNote) {
          try {
            const transcript = await base44.asServiceRole.integrations.Core.TranscribeAudio({
              audio_url: currentFileUrl,
            });
            const transcriptText = typeof transcript === 'string' ? transcript : transcript?.text || '';
            finalMessageText = String(transcriptText).trim().slice(0, 12000);
          } catch (transcribeErr) {
            console.error('Transcription failed:', transcribeErr instanceof Error ? transcribeErr.message : transcribeErr);
            throw new Error('VOICE_TRANSCRIPTION_FAILED');
          }
          if (!finalMessageText) throw new Error('NO_SOURCE_TEXT');
        }

        const sourceLabel = isVoiceNote ? 'a voice note' : 'a chat message';

        if (type === "meme") {
          const memePrompt = `You are a viral meme creator with a sharp, witty sense of humor. Turn ${sourceLabel} into a funny, shareable meme.

Message: "${finalMessageText}"
Sender: ${senderName || 'Someone'}

Create:
1. A punchy meme caption — think classic meme formats (top text / bottom text, or a single devastating one-liner). Keep it under 15 words. Make it genuinely funny, not cringe.
2. An image generation prompt for the meme's visual — a relatable, expressive, or absurd scene that pairs with the caption. NO text in the image.

Respond as JSON: { "caption": "the meme text", "image_prompt": "detailed visual prompt, no text, bold and colorful" }`;

          const memeRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: memePrompt,
            response_json_schema: {
              type: "object",
              properties: {
                caption: { type: "string" },
                image_prompt: { type: "string" }
              }
            }
          });

          const caption = String(memeRes?.caption || '').trim().slice(0, 300);
          const imagePrompt = String(memeRes?.image_prompt || '').trim().slice(0, 4000);
          if (!caption || !imagePrompt) throw new Error('INVALID_MEME_CONCEPT');

          const imgRes = await base44.asServiceRole.integrations.Core.GenerateImage({
            prompt: imagePrompt + ". Bold, vibrant, meme-worthy, high quality, no text, no words, no typography."
          });
          if (!imgRes || !imgRes.url) throw new Error("Image generation failed");

          return {
            type: "meme",
            caption,
            image_url: imgRes.url,
            source_text: finalMessageText
          };
        }

        const reelPrompt = `You are a viral short-form video creator. Turn ${sourceLabel} into a vertical video reel script for TikTok / Instagram Reels.

Message: "${finalMessageText}"
Sender: ${senderName || 'Someone'}

Create a 15-30 second vertical video script:
- 3-5 scenes, each with a vivid visual description and punchy on-screen text or voiceover
- A catchy post caption
- 5-8 relevant hashtags (without the # symbol)

Respond as JSON: {
  "scenes": [{ "visual": "what's shown on screen", "text": "on-screen text or voiceover", "duration": "approx seconds like '3s'" }],
  "caption": "post caption without hashtags",
  "hashtags": ["array", "of", "hashtag", "words"]
}`;

        const reelRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: reelPrompt,
          response_json_schema: {
            type: "object",
            properties: {
              scenes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    visual: { type: "string" },
                    text: { type: "string" },
                    duration: { type: "string" }
                  }
                }
              },
              caption: { type: "string" },
              hashtags: {
                type: "array",
                items: { type: "string" }
              }
            }
          }
        });

        return {
          type: "reel",
          ...reelRes,
          source_text: finalMessageText
        };
      },
    });

    return Response.json({ ...result, quota });
    } finally {
      await releaseConversationMembershipLock(entities, conversationLockId);
    }
  } catch (error) {
    if (error instanceof AiQuotaError) return aiQuotaErrorResponse(error);
    if (error instanceof Error && error.message === 'VOICE_TRANSCRIPTION_FAILED') {
      return Response.json({ error: 'Could not transcribe the voice note. Try a text message instead.' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'NO_SOURCE_TEXT') {
      return Response.json({ error: 'Message text or a voice note is required' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'INVALID_MEME_CONCEPT') {
      return Response.json({ error: 'AI returned an invalid meme concept' }, { status: 502 });
    }
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('generate-viral-moment error:', error);
    return Response.json({ error: 'Viral moment generation failed' }, { status: 500 });
  }
});