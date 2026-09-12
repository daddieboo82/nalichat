import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

const DELETE_BATCH_SIZE = 200;

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

    const writeRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'artpost_delete',
      60,
    );
    if (!writeRate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const { postId } = await req.json();
    if (!postId) return Response.json({ error: 'postId is required' }, { status: 400 });

    const entities = base44.asServiceRole.entities;
    const post = await entities.ArtPost.get(String(postId));
    if (!post) return Response.json({ error: 'Post not found' }, { status: 404 });
    if (post.creator_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the creator can delete this post' }, { status: 403 });
    }

    let deletedComments = 0;
    while (true) {
      const comments = await entities.TrackComment.filter(
        {
          track_id: post.id,
          parent_type: 'art_post',
        },
        '-created_date',
        DELETE_BATCH_SIZE,
      );
      if (comments.length === 0) break;
      for (const comment of comments) {
        await entities.TrackComment.delete(comment.id);
        deletedComments += 1;
      }
      if (comments.length < DELETE_BATCH_SIZE) break;
    }

    let playlistsUpdated = 0;
    while (true) {
      const playlists = await entities.Playlist.filter(
        { track_ids: post.id },
        '-created_date',
        200,
      );
      if (playlists.length === 0) break;

      for (const playlist of playlists) {
        const trackIds = Array.isArray(playlist.track_ids) ? playlist.track_ids : [];
        await entities.Playlist.update(playlist.id, {
          track_ids: trackIds.filter((id: string) => id !== post.id),
        });
        playlistsUpdated += 1;
      }

      if (playlists.length < 200) break;
    }

    await entities.ArtPost.delete(post.id);

    return Response.json({
      success: true,
      deleted_comments: deletedComments,
      playlists_updated: playlistsUpdated,
    });
  } catch (error) {
    console.error('deleteArtPost error:', error);
    return Response.json({ error: error?.message || 'Post deletion failed' }, { status: 500 });
  }
});
