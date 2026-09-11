import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { postId } = await req.json();
    if (!postId) return Response.json({ error: 'postId is required' }, { status: 400 });

    const entities = base44.asServiceRole.entities;
    const post = await entities.ArtPost.get(postId);
    if (!post || post.creator_id !== user.id) {
      return Response.json({ error: 'Post not found' }, { status: 404 });
    }

    const rewardId = `user_reward_art_post_${post.id}`;
    try {
      await entities.UserActivityReward.create({
        id: rewardId,
        user_id: user.id,
        source_type: 'art_post',
        source_id: post.id,
        xp: 50,
      });
    } catch {
      return Response.json({ success: true, awarded: false, duplicate: true });
    }

    try {
      await entities.User.updateMany({ id: user.id }, { $inc: { xp: 50 } });
    } catch (xpError) {
      // Compensate the deterministic dedupe record so a transient user-update
      // failure does not permanently consume an unawarded reward.
      await entities.UserActivityReward.delete(rewardId).catch(() => {});
      throw xpError;
    }
    return Response.json({ success: true, awarded: true, xp: 50 });
  } catch (error) {
    return Response.json({ error: error?.message || 'Could not award post XP' }, { status: 500 });
  }
});
