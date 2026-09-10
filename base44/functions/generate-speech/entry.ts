import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  AiQuotaError,
  aiQuotaErrorResponse,
  executeMeteredAiRequest,
} from '../../shared/aiQuota.ts';

// Generates TTS audio for Nali's voice replies.
// Moved to a backend function to protect integration credits — the client
// can no longer call GenerateSpeech directly.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { text, voice, request_key } = await req.json();
    if (!text || !text.trim()) {
      return Response.json({ error: 'Text is required' }, { status: 400 });
    }

    // Enforce the 5000-char limit from the integration docs
    const truncated = text.slice(0, 5000);

    const { result, quota } = await executeMeteredAiRequest({
      base44,
      user,
      operation: 'speech',
      requestKey: request_key,
      dispatch: () => base44.asServiceRole.integrations.Core.GenerateSpeech({
        text: truncated,
        voice: voice || 'honey',
      }),
    });

    return Response.json({ ...result, quota });
  } catch (error) {
    if (error instanceof AiQuotaError) return aiQuotaErrorResponse(error);
    console.error('generate-speech error:', error);
    const message = error instanceof Error ? error.message : 'Unable to generate speech';
    return Response.json({ error: message }, { status: 500 });
  }
});