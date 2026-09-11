import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requireEntitlement } from '../../shared/entitlementAccess.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { postId } = await req.json();
    if (!postId) return Response.json({ error: 'postId is required' }, { status: 400 });

    const post = await base44.asServiceRole.entities.ArtPost.get(postId);
    if (!post) return Response.json({ error: 'Track not found' }, { status: 404 });

    const isOwner = post.creator_id === user.id;
    if (!isOwner) {
      const { allowed } = await requireEntitlement(
        base44.asServiceRole.entities,
        user.id,
        'chat.export',
      );
      if (!allowed) {
        return Response.json({ error: 'Download entitlement required' }, { status: 403 });
      }
    }

    if (!post.file_url) return Response.json({ error: 'Track has no downloadable media' }, { status: 400 });
    return Response.json({ success: true, file_url: post.file_url, title: post.title || 'download' });
  } catch (error) {
    console.error('authorizeArtPostDownload error:', error);
    return Response.json({ error: error?.message || 'Could not authorize download' }, { status: 500 });
  }
});
