import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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