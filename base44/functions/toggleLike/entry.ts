import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

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

    return Response.json({ liked: !alreadyLiked, likes, liked_by });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}