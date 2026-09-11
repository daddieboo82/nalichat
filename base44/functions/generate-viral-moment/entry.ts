import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { requireEntitlement } from '../../shared/entitlementAccess.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

// Generates a viral "moment" from a chat message or voice note — either an
// AI meme (image + caption) or a vertical reel script for TikTok / Instagram.
// All credit-costly integration calls run server-side under asServiceRole.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
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

    const { messageId, type } = await req.json();
    if (!messageId) {
      return Response.json({ error: 'messageId is required' }, { status: 400 });
    }
    if (type !== 'meme' && type !== 'reel') {
      return Response.json({ error: 'type must be "meme" or "reel"' }, { status: 400 });
    }

    const message = await base44.asServiceRole.entities.Message.get(messageId);
    if (!message) {
      return Response.json({ error: 'Message not found' }, { status: 404 });
    }
    if (!Array.isArray(message.participant_ids) || !message.participant_ids.includes(user.id)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const senderName = message.sender_name || 'Someone';
    let finalMessageText = typeof message.text === 'string' ? message.text.trim() : '';
    const isVoiceNote =
      !finalMessageText &&
      !!message.file_url &&
      (message.type === 'audio' || String(message.file_type || '').startsWith('audio'));

    // Voice-note transcription only uses the media URL stored on the authorized
    // Message record. The browser can no longer make this function fetch an
    // arbitrary URL.
    if (isVoiceNote) {
      const voiceAccess = await requireEntitlement(
        base44.asServiceRole.entities,
        user.id,
        'voice.transcription',
      );
      if (!voiceAccess.allowed) {
        return Response.json({ error: 'Voice transcription is not available on your plan' }, { status: 403 });
      }

      try {
        const transcript = await base44.asServiceRole.integrations.Core.TranscribeAudio({
          audio_url: message.file_url,
        });
        finalMessageText = typeof transcript === 'string' ? transcript : transcript?.text || '';
      } catch (transcribeErr) {
        console.error('Transcription failed:', transcribeErr.message);
        return Response.json({ error: 'Could not transcribe the voice note. Try a text message instead.' }, { status: 400 });
      }
    }

    if (!finalMessageText || finalMessageText.trim().length === 0) {
      return Response.json({ error: 'Message text or a voice note is required' }, { status: 400 });
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

      const { caption, image_prompt } = memeRes;

      const imgRes = await base44.asServiceRole.integrations.Core.GenerateImage({
        prompt: image_prompt + ". Bold, vibrant, meme-worthy, high quality, no text, no words, no typography."
      });

      if (!imgRes || !imgRes.url) throw new Error("Image generation failed");

      return Response.json({
        type: "meme",
        caption,
        image_url: imgRes.url,
        source_text: finalMessageText
      });
    } else {
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

      return Response.json({
        type: "reel",
        ...reelRes,
        source_text: finalMessageText
      });
    }
  } catch (error) {
    console.error('generate-viral-moment error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});