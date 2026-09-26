import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

const audioTypes = new Set(['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/ogg', 'audio/flac']);
const maxBytes = 50 * 1024 * 1024;

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const client = createClientFromRequest(req);
    const user = await client.auth.me();
    if (!user?.id) return Response.json({ error: 'Sign in first.' }, { status: 401 });
    if (user.is_banned || (user.timeout_until && Date.parse(user.timeout_until) > Date.now())) {
      return Response.json({ error: 'Account cannot create battles right now.' }, { status: 403 });
    }
    const rate = await consumeHourlyLimit(client.asServiceRole.entities, user.id, 'battle_draft', 12);
    if (!rate.allowed) return Response.json({ error: 'Too many drafts. Please try again later.' }, { status: 429 });
    const length = Number(req.headers.get('content-length') || 0);
    if (length > maxBytes + 1024 * 1024) return Response.json({ error: 'Audio file is too large.' }, { status: 413 });
    const form = await req.formData();
    const title = String(form.get('title') || '').trim();
    const category = String(form.get('category') || '');
    const rights = form.get('rights_confirmed') === 'true';
    const file = form.get('file');
    if (!title || title.length > 100 || !['rap', 'singing'].includes(category)) {
      return Response.json({ error: 'Provide a title and battle style.' }, { status: 400 });
    }
    if (!rights) return Response.json({ error: 'Confirm you have permission to use your track.' }, { status: 400 });
    if (!(file instanceof File) || !file.size || file.size > maxBytes || !audioTypes.has(file.type)) {
      return Response.json({ error: 'Upload an MP3, M4A, WAV, WebM, OGG or FLAC track under 50 MB.' }, { status: 400 });
    }
    const uploaded = await client.asServiceRole.integrations.Core.UploadFile({ file });
    if (!uploaded?.file_url) throw new Error('Audio upload returned no URL');
    const battle = await client.asServiceRole.entities.LiveBattle.create({
      title, category, creator_id: user.id,
      creator_name: user.display_name || user.full_name || 'Artist',
      status: 'draft',
      creator_track_url: uploaded.file_url,
      creator_track_name: file.name.slice(0, 255),
      creator_votes: 0, opponent_votes: 0,
    });
    return Response.json({ success: true, action: 'create_battle_draft', battleId: battle.id, creatorId: user.id });
  } catch (error) {
    console.error('createBattleDraft failed:', error);
    return Response.json({ error: 'Could not save battle draft. Please try again.' }, { status: 500 });
  }
});