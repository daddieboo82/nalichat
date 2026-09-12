import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requireEntitlement } from '../../shared/entitlementAccess.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { isTrustedStoredMediaUrl } from '../../shared/mediaSecurity.ts';
import { isBase44EntityId } from '../../shared/workflowEvents.ts';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';

const MAX_TRANSCRIBE_BYTES = 50 * 1024 * 1024;

async function storedMediaSize(url: string): Promise<number | null> {
  try {
    const head = await fetch(url, { method: 'HEAD', redirect: 'manual' });
    if (head.ok) {
      const length = Number(head.headers.get('content-length'));
      if (Number.isFinite(length) && length >= 0) return length;
    }
  } catch {}

  try {
    const probe = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      redirect: 'manual',
    });
    if (probe.ok || probe.status === 206) {
      const range = probe.headers.get('content-range') || '';
      const match = range.match(/\/(\d+)$/);
      if (match) return Number(match[1]);
      const length = Number(probe.headers.get('content-length'));
      if (Number.isFinite(length) && length >= 0 && probe.status !== 206) return length;
    }
    try { await probe.body?.cancel(); } catch {}
  } catch {}
  return null;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_banned) return Response.json({ error: 'banned' }, { status: 403 });
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const rate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'voice_transcription',
      60,
    );
    if (!rate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const { messageId } = await readJsonBodyLimited(req, 8 * 1024);
    if (!isBase44EntityId(messageId)) return Response.json({ error: 'Valid messageId is required' }, { status: 400 });

    const entities = base44.asServiceRole.entities;
    const message = await entities.Message.get(String(messageId));
    if (!message) return Response.json({ error: 'Message not found' }, { status: 404 });
    if (!Array.isArray(message.participant_ids) || !message.participant_ids.includes(user.id)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!message.file_url || !['audio', 'file'].includes(message.type)) {
      return Response.json({ error: 'Message has no transcribable audio' }, { status: 400 });
    }
    if (!isTrustedStoredMediaUrl(message.file_url)) {
      return Response.json({ error: 'Stored audio host is not allowed' }, { status: 400 });
    }

    const mediaSize = await storedMediaSize(message.file_url);
    if (mediaSize === null) {
      return Response.json({ error: 'Could not verify stored audio size' }, { status: 400 });
    }
    if (mediaSize <= 0 || mediaSize > MAX_TRANSCRIBE_BYTES) {
      return Response.json({ error: 'Voice transcription supports audio up to 50MB' }, { status: 413 });
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
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('transcribeMessageAudio error:', error);
    return Response.json({ error: 'Transcription failed' }, { status: 500 });
  }
});
