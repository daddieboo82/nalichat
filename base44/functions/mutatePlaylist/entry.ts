import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { isBase44EntityId } from '../../shared/workflowEvents.ts';

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
    const playlistId = typeof body?.playlistId === 'string' ? body.playlistId.trim() : '';
    const action = typeof body?.action === 'string' ? body.action : '';
    if (!isBase44EntityId(playlistId) || !['add_track', 'remove_track', 'update_meta', 'delete'].includes(action)) {
      return Response.json({ error: 'Valid playlistId and action are required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const rate = await consumeHourlyLimit(entities, user.id, 'playlist_mutate', 300);
    if (!rate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }
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
      const trackId = typeof body?.trackId === 'string' ? body.trackId.trim() : '';
      if (!isBase44EntityId(trackId)) {
        return Response.json({ error: 'trackId is required' }, { status: 400 });
      }

      if (action === 'add_track') {
        const post = await entities.ArtPost.get(trackId).catch(() => null);
        if (!post) return Response.json({ error: 'Track not found' }, { status: 404 });
        const current = Array.isArray(playlist.track_ids) ? playlist.track_ids : [];
        if (!current.includes(trackId) && current.length >= 500) {
          return Response.json({ error: 'Playlist track limit reached' }, { status: 409 });
        }
        await entities.Playlist.updateMany(
          { id: playlist.id },
          { $addToSet: { track_ids: trackId } },
        );
      } else {
        await entities.Playlist.updateMany(
          { id: playlist.id },
          { $pull: { track_ids: trackId } },
        );
      }
      const updated = await entities.Playlist.get(playlist.id);
      return Response.json({ success: true, playlist: updated });
    }

    const patch: Record<string, unknown> = {};
    if (body?.name !== undefined) {
      if (typeof body.name !== 'string') {
        return Response.json({ error: 'Playlist name must be a string' }, { status: 400 });
      }
      const name = body.name.trim();
      if (!name) return Response.json({ error: 'Playlist name is required' }, { status: 400 });
      if (name.length > 120) {
        return Response.json({ error: 'Playlist name must be 120 characters or fewer' }, { status: 413 });
      }
      patch.name = name;
    }
    if (body?.description !== undefined) {
      if (typeof body.description !== 'string') {
        return Response.json({ error: 'Playlist description must be a string' }, { status: 400 });
      }
      const description = body.description.trim();
      if (description.length > 1000) {
        return Response.json({ error: 'Playlist description must be 1000 characters or fewer' }, { status: 413 });
      }
      patch.description = description;
    }
    if (body?.is_public !== undefined) {
      if (typeof body.is_public !== 'boolean') {
        return Response.json({ error: 'is_public must be a boolean' }, { status: 400 });
      }
      patch.is_public = body.is_public;
    }

    const updated = await entities.Playlist.update(playlist.id, patch);
    return Response.json({ success: true, playlist: updated });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('mutatePlaylist error:', error);
    return Response.json({ error: 'Playlist update failed' }, { status: 500 });
  }
});
