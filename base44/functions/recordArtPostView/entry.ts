import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { postId } = await req.json();
    if (!postId) return Response.json({ error: 'postId is required' }, { status: 400 });

    const entities = base44.asServiceRole.entities;
    const post = await entities.ArtPost.get(String(postId));
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

    await entities.ArtPost.updateMany(
      { id: post.id },
      { $inc: { views: 1 } },
    );
    const updated = await entities.ArtPost.get(post.id);
    return Response.json({ success: true, counted: true, views: Number(updated?.views || 0) });
  } catch (error) {
    console.error('recordArtPostView error:', error);
    return Response.json({ error: error?.message || 'Could not record view' }, { status: 500 });
  }
});
