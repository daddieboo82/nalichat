import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requireEntitlement } from '../../shared/entitlementAccess.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
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
      return Response.json({ error: 'Premium is required for AI speech' }, { status: 403 });
    }

    const rate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'ai_speech',
      60,
    );
    if (!rate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const { text, voice, request_key } = await readJsonBodyLimited(req, 16 * 1024);
    if (typeof text !== 'string' || !text.trim()) {
      return Response.json({ error: 'Text is required' }, { status: 400 });
    }
    if (text.length > 5000) {
      return Response.json({ error: 'Text must be 5000 characters or fewer' }, { status: 413 });
    }
    if (voice != null && voice !== 'honey') {
      return Response.json({ error: 'Unsupported voice' }, { status: 400 });
    }

    const { result, quota } = await executeMeteredAiRequest({
      base44,
      user,
      operation: 'ai_speech',
      requestKey: request_key,
      dispatch: () => base44.asServiceRole.integrations.Core.GenerateSpeech({
        text,
        voice: 'honey',
      }),
    });

    const payload = result && typeof result === 'object' && !Array.isArray(result)
      ? { ...result, quota }
      : { url: result, quota };
    return Response.json(payload);
  } catch (error) {
    if (error instanceof AiQuotaError) return aiQuotaErrorResponse(error);
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('generate-speech error:', error instanceof Error ? error.message : error);
    return Response.json({ error: 'AI speech generation failed' }, { status: 500 });
  }
});