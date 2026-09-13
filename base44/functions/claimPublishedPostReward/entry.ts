import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
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
    if (user.is_banned) {
      return Response.json({ error: 'banned' }, { status: 403 });
    }
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const { postId } = await readJsonBodyLimited(req, 8 * 1024);
    if (!isBase44EntityId(postId)) {
      return Response.json({ error: 'Valid postId is required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const rewardRate = await consumeHourlyLimit(
      entities,
      user.id,
      'published_post_reward_claim',
      60,
    );
    if (!rewardRate.allowed) {
      return Response.json({ error: 'Reward claim rate limit exceeded. Please try again later.' }, { status: 429 });
    }

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
    } catch (createError) {
      const existing = await entities.UserActivityReward.get(rewardId).catch(() => null);
      if (
        existing?.user_id === user.id
        && existing?.source_type === 'art_post'
        && existing?.source_id === post.id
      ) {
        return Response.json({ success: true, action: 'claim_publish_reward', userId: user.id, postId: post.id, awarded: false, duplicate: true, xp: 50 });
      }
      throw createError;
    }

    try {
      const xpUpdate = await entities.User.updateMany(
        { id: user.id },
        { $inc: { xp: 50 } },
      );
      if (Number(xpUpdate?.updated || 0) !== 1) {
        throw new Error('User XP update did not modify exactly one account');
      }
    } catch (xpError) {
      // Compensate the deterministic dedupe record so a transient user-update
      // failure does not permanently consume an unawarded reward.
      try {
        await entities.UserActivityReward.delete(rewardId);
      } catch (rollbackError) {
        console.error('Published-post reward rollback failed:', rollbackError);
        throw new Error(
          'Post XP update failed and reward rollback was incomplete. Please retry.',
          { cause: xpError },
        );
      }
      throw xpError;
    }
    return Response.json({ success: true, action: 'claim_publish_reward', userId: user.id, postId: post.id, awarded: true, duplicate: false, xp: 50 });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    return Response.json({ error: 'Could not award post XP' }, { status: 500 });
  }
});
