import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { withBattleLock } from '../../shared/liveBattleLock.ts';
const audioTypes = new Set(['audio/mpeg','audio/mp4','audio/x-m4a','audio/wav','audio/x-wav','audio/webm','audio/ogg','audio/flac']);
Deno.serve(async req => {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const client = createClientFromRequest(req);
    const user = await client.auth.me();
    if (!user?.id || user.is_banned) return Response.json({ error: 'Not authorized.' }, { status: 403 });
    const length = Number(req.headers.get('content-length') || 0);
    if (length > 51 * 1024 * 1024) return Response.json({ error: 'File too large.' }, { status: 413 });
    const form = await req.formData();
    const battleId = String(form.get('battle_id') || '');
    const file = form.get('file');
    if (!/^[a-z0-9_-]{10,80}$/i.test(battleId) || !(file instanceof File) || !file.size
      || file.size > 50 * 1024 * 1024 || !audioTypes.has(file.type)
      || form.get('rights_confirmed') !== 'true') {
      return Response.json({ error: 'Valid audio and permission confirmation required.' }, { status: 400 });
    }
    const entities = client.asServiceRole.entities;
    return await withBattleLock(entities, battleId, async () => {
      const battle = await entities.LiveBattle.get(battleId).catch(() => null);
      if (!battle || battle.opponent_id !== user.id || !['invited','ready'].includes(battle.status)) {
        return Response.json({ error: 'Only the invited artist can attach a track before going live.' }, { status: 403 });
      }
      const upload = await client.asServiceRole.integrations.Core.UploadFile({ file });
      if (!upload?.file_url) throw new Error('Missing file URL');
      await entities.LiveBattle.update(battleId, { opponent_track_url: upload.file_url, opponent_track_name: file.name.slice(0,255) });
      return Response.json({ success: true, battleId });
    });
  } catch (error) {
    console.error('uploadBattleOpponentTrack failed', error);
    return Response.json({ error: 'Could not upload track.' }, { status: 500 });
  }
});