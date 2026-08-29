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
    const liked_by = alreadyLiked
      ? (post.liked_by || []).filter(id => id !== user.id)
      : [...(post.liked_by || []), user.id];
    const likes = Math.max(0, (post.likes || 0) + (alreadyLiked ? -1 : 1));

    await base44.asServiceRole.entities.ArtPost.update(postId, { liked_by, likes });

    return Response.json({ liked: !alreadyLiked, likes, liked_by });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}