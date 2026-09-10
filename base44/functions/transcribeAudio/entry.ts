import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  AiQuotaError,
  aiQuotaErrorResponse,
  executeMeteredAiRequest,
} from '../../shared/aiQuota.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { audio_url, request_key } = await req.json();
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(audio_url);
    } catch {
      return Response.json({ error: 'A valid audio URL is required.' }, { status: 400 });
    }
    if (parsedUrl.protocol !== 'https:') {
      return Response.json({ error: 'Audio URL must use HTTPS.' }, { status: 400 });
    }

    const { result, quota } = await executeMeteredAiRequest({
      base44,
      user,
      operation: 'transcription',
      requestKey: request_key,
      dispatch: () => base44.asServiceRole.integrations.Core.TranscribeAudio({ audio_url }),
    });
    const text = typeof result === 'string' ? result : result?.text || result?.data || '';

    return Response.json({ text, quota });
  } catch (error) {
    if (error instanceof AiQuotaError) return aiQuotaErrorResponse(error);
    console.error('transcribeAudio error:', error);
    const message = error instanceof Error ? error.message : 'Unable to transcribe audio';
    return Response.json({ error: message }, { status: 500 });
  }
});
