import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_banned) return Response.json({ error: 'banned' }, { status: 403 });

    const body = await req.json();
    const playlistId = String(body?.playlistId || '');
    const action = String(body?.action || '');
    if (!playlistId || !['add_track', 'remove_track', 'update_meta', 'delete'].includes(action)) {
      return Response.json({ error: 'Valid playlistId and action are required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const playlist = await entities.Playlist.get(playlistId);
    if (!playlist) return Response.json({ error: 'Playlist not found' }, { status: 404 });
    if (playlist.owner_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (action === 'delete') {
      await entities.Playlist.delete(playlist.id);
      return Response.json({ success: true, deleted: true });
    }

    if (action === 'add_track' || action === 'remove_track') {
      const trackId = String(body?.trackId || '');
      if (!trackId) return Response.json({ error: 'trackId is required' }, { status: 400 });

      if (action === 'add_track') {
        const post = await entities.ArtPost.get(trackId).catch(() => null);
        if (!post) return Response.json({ error: 'Track not found' }, { status: 404 });
      }

      const current = Array.isArray(playlist.track_ids) ? playlist.track_ids : [];
      const next = action === 'add_track'
        ? Array.from(new Set([...current, trackId])).slice(0, 500)
        : current.filter((id: string) => id !== trackId);
      const updated = await entities.Playlist.update(playlist.id, { track_ids: next });
      return Response.json({ success: true, playlist: updated });
    }

    const patch: Record<string, unknown> = {};
    if (body?.name !== undefined) {
      const name = String(body.name || '').trim().slice(0, 120);
      if (!name) return Response.json({ error: 'Playlist name is required' }, { status: 400 });
      patch.name = name;
    }
    if (body?.description !== undefined) patch.description = String(body.description || '').trim().slice(0, 1000);
    if (body?.is_public !== undefined) patch.is_public = Boolean(body.is_public);

    const updated = await entities.Playlist.update(playlist.id, patch);
    return Response.json({ success: true, playlist: updated });
  } catch (error) {
    console.error('mutatePlaylist error:', error);
    return Response.json({ error: error?.message || 'Playlist update failed' }, { status: 500 });
  }
});
