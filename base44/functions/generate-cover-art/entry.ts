import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { requireEntitlement } from '../../shared/entitlementAccess.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

// Generates AI cover art for a track: transcribes audio, uses LLM to craft
// an image prompt, then generates the image. All three credit-costly
// integration calls run server-side under asServiceRole.
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
      return Response.json({ error: 'Premium is required for AI cover art' }, { status: 403 });
    }

    const rate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'ai_cover_art',
      20,
    );
    if (!rate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const { file_url, title, genre, tags } = await req.json();

    // Step 1: Transcribe audio if available
    let transcript = "No lyrics available.";
    if (file_url) {
      try {
        transcript = await base44.asServiceRole.integrations.Core.TranscribeAudio({ audio_url: file_url }) || transcript;
      } catch (e) {
        console.error("Transcription failed:", e.message);
      }
    }

    // Step 2: Generate image prompt with LLM
    const prompt = `You are a visionary, avant-garde album cover designer.
Analyze the following track details:
Title: ${title || 'Untitled'}
Genre: ${genre || 'Unknown'}
Tags: ${tags ? tags.join(', ') : 'None'}
Lyrics/Vibe: ${transcript}

Create a highly detailed, breathtaking, and completely unique image generation prompt for an album cover that perfectly captures the mood and themes of this track.
CRITICAL: Do NOT include any text, typography, or words in the image itself. Focus entirely on the visual elements, lighting, style, and atmosphere.
Respond with ONLY the raw image generation prompt string, nothing else.`;

    const aiPrompt = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt });

    // Step 3: Generate image
    const imgRes = await base44.asServiceRole.integrations.Core.GenerateImage({ prompt: aiPrompt });
    if (!imgRes || !imgRes.url) throw new Error("Image generation failed");

    return Response.json({ image_url: imgRes.url });
  } catch (error) {
    console.error('generate-cover-art error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});