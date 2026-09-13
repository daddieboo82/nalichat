import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { isBase44EntityId } from '../../shared/workflowEvents.ts';
import {
  acquireArtPostEngagementLock,
  releaseArtPostEngagementLock,
} from '../../shared/artPostEngagementLock.ts';

export default async function(req) {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_banned) return Response.json({ error: 'banned' }, { status: 403 });
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const writeRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'artpost_like',
      600,
    );
    if (!writeRate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const body = await readJsonBodyLimited(req, 8 * 1024);
    const postId = typeof body?.postId === 'string' ? body.postId.trim() : '';
    if (!isBase44EntityId(postId)) {
      return Response.json({ error: 'Valid postId is required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const postPreview = await entities.ArtPost.get(postId).catch(() => null);
    if (!postPreview) return Response.json({ error: 'Post not found' }, { status: 404 });

    const lockId = await acquireArtPostEngagementLock(entities, postId);
    if (!lockId) {
      return Response.json(
        { error: 'Post engagement is being updated. Please retry.' },
        { status: 409 },
      );
    }

    try {
    const post = await entities.ArtPost.get(postId);
    if (!post) return Response.json({ error: 'Post not found' }, { status: 404 });

    const alreadyLiked = (post.liked_by || []).includes(user.id);

    // Use atomic $addToSet/$pull to prevent race conditions on concurrent likes.
    // Verify the write actually reached this post before reporting the toggled state.
    const likeUpdate = alreadyLiked
      ? await entities.ArtPost.updateMany(
          { id: postId },
          { $pull: { liked_by: user.id } },
        )
      : await entities.ArtPost.updateMany(
          { id: postId },
          { $addToSet: { liked_by: user.id } },
        );
    if (Number(likeUpdate?.updated || 0) !== 1) {
      return Response.json({ error: 'Like update did not apply. Please retry.' }, { status: 409 });
    }

    // Read back to sync the likes count with the actual liked_by array
    const updated = await entities.ArtPost.get(postId);
    const liked_by = updated.liked_by || [];
    const likes = liked_by.length;
    await entities.ArtPost.update(postId, { likes });

    return Response.json({ success: true, userId: user.id, post_id: postId, liked: !alreadyLiked, likes });
    } finally {
      await releaseArtPostEngagementLock(entities, lockId);
    }
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    return Response.json({ error: 'Like update failed' }, { status: 500 });
  }
}