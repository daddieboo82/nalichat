import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { isBase44EntityId } from '../../shared/workflowEvents.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    if (user.is_banned) return Response.json({ error: 'banned' }, { status: 403 });

    const body = await readJsonBodyLimited(req, 32 * 1024);
    if (body?.name != null && typeof body.name !== 'string') {
      return Response.json({ error: 'Playlist name must be a string' }, { status: 400 });
    }
    if (body?.description != null && typeof body.description !== 'string') {
      return Response.json({ error: 'Playlist description must be a string' }, { status: 400 });
    }
    if (body?.track_ids != null && !Array.isArray(body.track_ids)) {
      return Response.json({ error: 'track_ids must be an array' }, { status: 400 });
    }

    const name = String(body?.name || '').trim();
    const description = String(body?.description || '').trim();
    const rawTrackIds = Array.isArray(body?.track_ids) ? body.track_ids : [];
    if (rawTrackIds.length > 500) {
      return Response.json({ error: 'Playlists support at most 500 tracks' }, { status: 413 });
    }
    const trackIds = Array.from(new Set(
      rawTrackIds
        .filter((id: unknown) => typeof id === 'string')
        .map((id: string) => id.trim())
        .filter(Boolean),
    ));
    if (trackIds.some((id) => !isBase44EntityId(id))) {
      return Response.json({ error: 'track_ids must contain valid track IDs' }, { status: 400 });
    }

    if (!name) return Response.json({ error: 'Playlist name is required' }, { status: 400 });
    if (name.length > 120) {
      return Response.json({ error: 'Playlist name must be 120 characters or fewer' }, { status: 413 });
    }
    if (description.length > 1000) {
      return Response.json({ error: 'Playlist description must be 1000 characters or fewer' }, { status: 413 });
    }

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
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('createPlaylist error:', error);
    return Response.json({ error: 'Could not create playlist' }, { status: 500 });
  }
});
