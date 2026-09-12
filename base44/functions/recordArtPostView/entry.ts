import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit, releaseSingleHourlyClaim } from '../../shared/rateLimit.ts';

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
    if (typeof postId !== 'string' || !postId.trim() || postId.length > 200) {
      return Response.json({ error: 'postId is required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const post = await entities.ArtPost.get(postId);
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
      return Response.json({ success: true, counted: false, views: Number(post.views || 0) });
    }

    try {
      await entities.ArtPost.updateMany(
        { id: post.id },
        { $inc: { views: 1 } },
      );
    } catch (countError) {
      await releaseSingleHourlyClaim(
        entities,
        user.id,
        `artpost_view:${post.id}`,
      );
      throw countError;
    }
    const updated = await entities.ArtPost.get(post.id);
    return Response.json({ success: true, counted: true, views: Number(updated?.views || 0) });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('recordArtPostView error:', error);
    return Response.json({ error: error?.message || 'Could not record view' }, { status: 500 });
  }
});
