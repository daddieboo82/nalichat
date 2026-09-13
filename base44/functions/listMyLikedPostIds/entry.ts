import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

async function listAllLikedPosts(entity: any, userId: string) {
  const rows: any[] = [];
  const pageSize = 200;
  for (let skip = 0; ; skip += pageSize) {
    const page = await entity.filter(
      { liked_by: userId },
      '-created_date',
      pageSize,
      skip,
    );
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

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

    const likedRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'liked_post_lookup',
      300,
    );
    if (!likedRate.allowed) {
      return Response.json({ error: 'Liked-post lookup rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const posts = await listAllLikedPosts(
      base44.asServiceRole.entities.ArtPost,
      user.id,
    );
    return Response.json({
      success: true,
      post_ids: posts.map((post: any) => post.id).filter(Boolean),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('listMyLikedPostIds error:', error);
    return Response.json({ error: 'Could not load likes' }, { status: 500 });
  }
});
