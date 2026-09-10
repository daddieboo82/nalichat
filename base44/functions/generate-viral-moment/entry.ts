import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  AiQuotaError,
  aiQuotaErrorResponse,
  executeMeteredAiRequest,
} from '../../shared/aiQuota.ts';

async function resolveMessageText(base44, messageText: unknown, audioUrl: unknown) {
  if (typeof messageText === 'string' && messageText.trim()) return messageText.trim();
  if (typeof audioUrl !== 'string' || !audioUrl) {
    throw new Error('Message text or a voice note is required');
  }
  const transcript = await base44.asServiceRole.integrations.Core.TranscribeAudio({
    audio_url: audioUrl,
  });
  const text = typeof transcript === 'string' ? transcript : transcript?.text || '';
  if (!text.trim()) throw new Error('Could not transcribe the voice note.');
  return text.trim();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { messageText, senderName, type, audioUrl, request_key } = await req.json();
    if (type !== 'meme' && type !== 'reel') {
      return Response.json({ error: 'Type must be meme or reel.' }, { status: 400 });
    }
    if (!(typeof messageText === 'string' && messageText.trim()) && !audioUrl) {
      return Response.json({ error: 'Message text or a voice note is required' }, { status: 400 });
    }

    const { result, quota } = await executeMeteredAiRequest({
      base44,
      user,
      operation: type === 'meme' ? 'viral_meme' : 'viral_reel',
      requestKey: request_key,
      dispatch: async () => {
        const finalMessageText = await resolveMessageText(base44, messageText, audioUrl);
        const sourceLabel = audioUrl && !messageText ? 'a voice note' : 'a chat message';

        if (type === 'meme') {
          const memeRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: `Turn ${sourceLabel} into a funny, shareable meme.

Message: "${finalMessageText}"
Sender: ${senderName || 'Someone'}

Return JSON with a caption under 15 words and an image_prompt with no text or typography.`,
            response_json_schema: {
              type: 'object',
              properties: {
                caption: { type: 'string' },
                image_prompt: { type: 'string' },
              },
            },
          });
          const imgRes = await base44.asServiceRole.integrations.Core.GenerateImage({
            prompt: `${memeRes.image_prompt}. Bold, vibrant, meme-worthy, high quality, no text, no words, no typography.`,
          });
          if (!imgRes?.url) throw new Error('Image generation failed');
          return {
            type: 'meme',
            caption: memeRes.caption,
            image_url: imgRes.url,
            source_text: finalMessageText,
          };
        }

        const reelRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Turn ${sourceLabel} into a 15-30 second vertical video reel script.

Message: "${finalMessageText}"
Sender: ${senderName || 'Someone'}

Return 3-5 scenes with visual, text, and duration, plus a caption and 5-8 hashtags.`,
          response_json_schema: {
            type: 'object',
            properties: {
              scenes: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    visual: { type: 'string' },
                    text: { type: 'string' },
                    duration: { type: 'string' },
                  },
                },
              },
              caption: { type: 'string' },
              hashtags: { type: 'array', items: { type: 'string' } },
            },
          },
        });
        return { type: 'reel', ...reelRes, source_text: finalMessageText };
      },
    });

    return Response.json({ ...result, quota });
  } catch (error) {
    if (error instanceof AiQuotaError) return aiQuotaErrorResponse(error);
    console.error('generate-viral-moment error:', error);
    const message = error instanceof Error ? error.message : 'Unable to generate viral moment';
    return Response.json({ error: message }, { status: 500 });
  }
});
