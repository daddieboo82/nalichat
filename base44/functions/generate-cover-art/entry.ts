import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  AiQuotaError,
  aiQuotaErrorResponse,
  executeMeteredAiRequest,
} from '../../shared/aiQuota.ts';

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

    const { file_url, title, genre, tags, request_key } = await req.json();

    const { result, quota } = await executeMeteredAiRequest({
      base44,
      user,
      operation: 'cover_art',
      requestKey: request_key,
      dispatch: async () => {
        // Step 1: Transcribe audio if available
        let transcript = "No lyrics available.";
        if (file_url) {
          try {
            transcript = await base44.asServiceRole.integrations.Core.TranscribeAudio({ audio_url: file_url }) || transcript;
          } catch (error) {
            console.error("Cover-art transcription failed:", error);
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
        return imgRes;
      },
    });

    return Response.json({ image_url: result.url, quota });
  } catch (error) {
    if (error instanceof AiQuotaError) return aiQuotaErrorResponse(error);
    console.error('generate-cover-art error:', error);
    const message = error instanceof Error ? error.message : 'Unable to generate cover art';
    return Response.json({ error: message }, { status: 500 });
  }
});