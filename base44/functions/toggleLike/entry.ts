import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

export default async function(req) {
  try {
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

    const body = await req.json();
    const postId = body.postId;
    if (!postId) return Response.json({ error: 'postId required' }, { status: 400 });

    const post = await base44.asServiceRole.entities.ArtPost.get(postId);
    if (!post) return Response.json({ error: 'Post not found' }, { status: 404 });

    const alreadyLiked = (post.liked_by || []).includes(user.id);

    // Use atomic $addToSet/$pull to prevent race conditions on concurrent likes
    if (alreadyLiked) {
      await base44.asServiceRole.entities.ArtPost.updateMany({ id: postId }, { $pull: { liked_by: user.id } });
    } else {
      await base44.asServiceRole.entities.ArtPost.updateMany({ id: postId }, { $addToSet: { liked_by: user.id } });
    }

    // Read back to sync the likes count with the actual liked_by array
    const updated = await base44.asServiceRole.entities.ArtPost.get(postId);
    const liked_by = updated.liked_by || [];
    const likes = liked_by.length;
    await base44.asServiceRole.entities.ArtPost.update(postId, { likes });

    return Response.json({ liked: !alreadyLiked, likes });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}