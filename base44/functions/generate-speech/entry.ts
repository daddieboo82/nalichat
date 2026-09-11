import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { requireEntitlement } from '../../shared/entitlementAccess.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

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

    const { text, voice } = await req.json();
    if (!text || !text.trim()) {
      return Response.json({ error: 'Text is required' }, { status: 400 });
    }

    // Enforce the 5000-char limit from the integration docs
    const truncated = text.slice(0, 5000);

    const result = await base44.asServiceRole.integrations.Core.GenerateSpeech({
      text: truncated,
      voice: voice || 'honey',
    });

    return Response.json(result);
  } catch (error) {
    console.error('generate-speech error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});