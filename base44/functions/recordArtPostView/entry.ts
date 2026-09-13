import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit, releaseSingleHourlyClaim } from '../../shared/rateLimit.ts';
import { isBase44EntityId } from '../../shared/workflowEvents.ts';
import {
  acquireArtPostEngagementLock,
  releaseArtPostEngagementLock,
} from '../../shared/artPostEngagementLock.ts';

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

    const { postId } = await readJsonBodyLimited(req, 8 * 1024);
    if (!isBase44EntityId(postId)) {
      return Response.json({ error: 'Valid postId is required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const lookupRate = await consumeHourlyLimit(
      entities,
      user.id,
      'artpost_view_lookup',
      600,
    );
    if (!lookupRate.allowed) {
      return Response.json({ error: 'View tracking rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const postPreview = await entities.ArtPost.get(postId).catch(() => null);
    if (!postPreview) return Response.json({ error: 'Post not found' }, { status: 404 });

    if (postPreview.creator_id === user.id) {
      return Response.json({
        success: true,
        action: 'record_art_post_view',
        userId: user.id,
        postId,
        counted: false,
        reason: 'owner',
        views: Number(postPreview.views || 0),
      });
    }

    const lockId = await acquireArtPostEngagementLock(entities, postId);
    if (!lockId) {
      return Response.json({ error: 'Post is being updated. Please retry.' }, { status: 409 });
    }

    try {
      const post = await entities.ArtPost.get(postId).catch(() => null);
      if (!post) return Response.json({ error: 'Post not found' }, { status: 404 });
      if (post.creator_id === user.id) {
        return Response.json({
          success: true,
          counted: false,
          reason: 'owner',
          views: Number(post.views || 0),
        });
      }

      const rate = await consumeHourlyLimit(
        entities,
        user.id,
        `artpost_view:${post.id}`,
        1,
      );
      if (!rate.allowed) {
        return Response.json({ success: true, action: 'record_art_post_view', userId: user.id, postId, counted: false, reason: 'already_counted', views: Number(post.views || 0) });
      }

      try {
        const countUpdate = await entities.ArtPost.updateMany(
          { id: post.id },
          { $inc: { views: 1 } },
        );
        if (Number(countUpdate?.updated || 0) !== 1) {
          throw new Error('ArtPost view count did not update exactly one post');
        }
      } catch (countError) {
        await releaseSingleHourlyClaim(
          entities,
          user.id,
          `artpost_view:${post.id}`,
        );
        throw countError;
      }
      const updated = await entities.ArtPost.get(post.id);
      return Response.json({ success: true, action: 'record_art_post_view', userId: user.id, postId, counted: true, views: Number(updated?.views || 0) });
    } finally {
      await releaseArtPostEngagementLock(entities, lockId);
    }
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('recordArtPostView error:', error);
    return Response.json({ error: 'Could not record view' }, { status: 500 });
  }
});
