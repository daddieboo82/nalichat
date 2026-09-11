import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  AiQuotaError,
  aiQuotaErrorResponse,
} from '../../shared/aiQuota.ts';
import {
  VoiceTranscriptionError,
  requestVoiceTranscription,
  voiceTranscriptionErrorResponse,
} from '../../shared/voiceTranscription.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { message_id, request_key } = await req.json();
    const result = await requestVoiceTranscription({
      base44,
      user,
      messageId: message_id,
      requestKey: request_key,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof AiQuotaError) return aiQuotaErrorResponse(error);
    if (error instanceof VoiceTranscriptionError) {
      return voiceTranscriptionErrorResponse(error);
    }
    console.error('transcribeAudio error:', error);
    return Response.json({
      error: 'Unable to transcribe this voice note.',
      code: 'TRANSCRIPTION_ERROR',
    }, { status: 500 });
  }
});
