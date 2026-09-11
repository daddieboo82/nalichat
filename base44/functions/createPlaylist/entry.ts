import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    if (user.is_banned) return Response.json({ error: 'banned' }, { status: 403 });

    const body = await req.json();
    const name = String(body?.name || '').trim().slice(0, 120);
    const description = String(body?.description || '').trim().slice(0, 1000);
    const trackIds = Array.isArray(body?.track_ids)
      ? Array.from(new Set(body.track_ids.map((id: unknown) => String(id || '').trim()).filter(Boolean))).slice(0, 500)
      : [];

    if (!name) return Response.json({ error: 'Playlist name is required' }, { status: 400 });

    const entities = base44.asServiceRole.entities;
    const rate = await consumeHourlyLimit(entities, user.id, 'playlist_create', 60);
    if (!rate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }
    for (const trackId of trackIds) {
      const track = await entities.ArtPost.get(trackId).catch(() => null);
      if (!track) {
        return Response.json({ error: 'One or more playlist tracks were not found' }, { status: 400 });
      }
    }

    const playlist = await entities.Playlist.create({
      name,
      description,
      owner_id: user.id,
      owner_name: user.display_name || user.full_name || 'User',
      track_ids: trackIds,
      is_public: Boolean(body?.is_public),
    });

    return Response.json({ success: true, playlist });
  } catch (error) {
    console.error('createPlaylist error:', error);
    return Response.json({ error: error?.message || 'Could not create playlist' }, { status: 500 });
  }
});
