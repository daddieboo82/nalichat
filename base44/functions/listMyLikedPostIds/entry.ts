import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const likedRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'liked_post_lookup',
      300,
    );
    if (!likedRate.allowed) {
      return Response.json({ error: 'Liked-post lookup rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const posts = await base44.asServiceRole.entities.ArtPost.filter({ liked_by: user.id });
    return Response.json({
      post_ids: posts.map((post: any) => post.id).filter(Boolean),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('listMyLikedPostIds error:', error);
    return Response.json({ error: error?.message || 'Could not load likes' }, { status: 500 });
  }
});
