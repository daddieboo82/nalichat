import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const MUTABLE_KEYS = new Set([
  'name','volume','pan','muted','solo','color','description','waveform_data','duration'
]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const trackId = String(body?.trackId || '');
    const action = body?.action;
    if (!trackId || !['update', 'delete'].includes(action)) {
      return Response.json({ error: 'Valid trackId and action are required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const track = await entities.Track.get(trackId);
    if (!track) return Response.json({ error: 'Track not found' }, { status: 404 });

    const canEdit = user.role === 'admin' || (track.edit_user_ids || []).includes(user.id);
    if (!canEdit) return Response.json({ error: 'Viewer access cannot modify this track' }, { status: 403 });

    if (action === 'delete') {
      const [versions, comments] = await Promise.all([
        entities.TrackVersion.filter({ track_id: track.id }),
        entities.TrackComment.filter({ track_id: track.id, parent_type: 'track' }),
      ]);
      for (const version of versions) await entities.TrackVersion.delete(version.id);
      for (const comment of comments) await entities.TrackComment.delete(comment.id);
      await entities.Track.delete(track.id);
      return Response.json({
        success: true,
        deleted: true,
        deleted_versions: versions.length,
        deleted_comments: comments.length,
      });
    }

    const input = body?.data || {};
    const patch: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      if (MUTABLE_KEYS.has(key)) patch[key] = value;
    }

    if (patch.name !== undefined) {
      const name = String(patch.name || '').trim().slice(0, 200);
      if (!name) return Response.json({ error: 'Track name cannot be empty' }, { status: 400 });
      patch.name = name;
    }
    if (patch.description !== undefined) patch.description = String(patch.description || '').slice(0, 1000);
    if (patch.color !== undefined) patch.color = String(patch.color || '').slice(0, 100);

    if (patch.volume !== undefined) {
      const volume = Number(patch.volume);
      if (!Number.isFinite(volume) || volume < 0 || volume > 100) {
        return Response.json({ error: 'Track volume must be between 0 and 100' }, { status: 400 });
      }
      patch.volume = volume;
    }
    if (patch.pan !== undefined) {
      const pan = Number(patch.pan);
      if (!Number.isFinite(pan) || pan < 0 || pan > 100) {
        return Response.json({ error: 'Track pan must be between 0 and 100' }, { status: 400 });
      }
      patch.pan = pan;
    }
    if (patch.duration !== undefined) {
      const duration = Number(patch.duration);
      if (!Number.isFinite(duration) || duration < 0 || duration > 24 * 60 * 60) {
        return Response.json({ error: 'Invalid track duration' }, { status: 400 });
      }
      patch.duration = duration;
    }
    if (patch.muted !== undefined) patch.muted = Boolean(patch.muted);
    if (patch.solo !== undefined) patch.solo = Boolean(patch.solo);
    if (patch.waveform_data !== undefined) {
      if (!Array.isArray(patch.waveform_data)) {
        return Response.json({ error: 'waveform_data must be an array' }, { status: 400 });
      }
      patch.waveform_data = patch.waveform_data
        .map((point: unknown) => Number(point))
        .filter((point: number) => Number.isFinite(point) && point >= -1 && point <= 1)
        .slice(0, 2000);
    }

    if (Object.keys(patch).length === 0) {
      return Response.json({ error: 'No supported track fields supplied' }, { status: 400 });
    }

    const updated = await entities.Track.update(track.id, patch);
    return Response.json({ success: true, track: updated });
  } catch (error) {
    return Response.json({ error: error?.message || 'Track mutation failed' }, { status: 500 });
  }
});
