import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requireEntitlement } from '../../shared/entitlementAccess.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { messageId } = await req.json();
    if (!messageId) return Response.json({ error: 'messageId is required' }, { status: 400 });

    const entities = base44.asServiceRole.entities;
    const message = await entities.Message.get(String(messageId));
    if (!message) return Response.json({ error: 'Message not found' }, { status: 404 });
    if (!Array.isArray(message.participant_ids) || !message.participant_ids.includes(user.id)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!message.file_url || !['audio', 'file'].includes(message.type)) {
      return Response.json({ error: 'Message has no transcribable audio' }, { status: 400 });
    }

    const { allowed } = await requireEntitlement(entities, user.id, 'voice.transcription');
    if (!allowed) {
      return Response.json({ error: 'Premium is required for voice transcription' }, { status: 403 });
    }

    const result = await base44.asServiceRole.integrations.Core.TranscribeAudio({
      audio_url: message.file_url,
    });
    const text = typeof result === 'string' ? result : result?.text || result?.data || '';
    return Response.json({ text: String(text || '').trim() });
  } catch (error) {
    console.error('transcribeMessageAudio error:', error);
    return Response.json({ error: error?.message || 'Transcription failed' }, { status: 500 });
  }
});
