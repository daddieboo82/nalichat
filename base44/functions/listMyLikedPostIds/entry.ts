import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const posts = await base44.asServiceRole.entities.ArtPost.filter({ liked_by: user.id });
    return Response.json({
      post_ids: posts.map((post: any) => post.id).filter(Boolean),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('listMyLikedPostIds error:', error);
    return Response.json({ error: error?.message || 'Could not load likes' }, { status: 500 });
  }
});
