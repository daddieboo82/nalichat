import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const ALLOWED_MEDIA = new Set(['original','remix','cover','beat','production','mixing','mastering','collab']);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const title = String(body?.title || '').trim().slice(0, 200);
    const fileUrl = String(body?.file_url || '').trim();
    if (!title || !fileUrl) {
      return Response.json({ error: 'title and file_url are required' }, { status: 400 });
    }

    const medium = ALLOWED_MEDIA.has(body?.medium) ? body.medium : 'original';

    const post = await base44.asServiceRole.entities.ArtPost.create({
      title,
      description: String(body?.description || '').slice(0, 2000),
      image_url: body?.image_url ? String(body.image_url) : null,
      file_url: fileUrl,
      medium,
      tags: Array.isArray(body?.tags)
        ? body.tags.map((tag: any) => String(tag).slice(0, 64)).slice(0, 30)
        : [],
      creator_id: user.id,
      creator_name: user.display_name || user.full_name || user.email || 'User',
      creator_avatar: user.avatar_url || null,
      duration: Number.isFinite(Number(body?.duration)) ? Number(body.duration) : undefined,
      genre: String(body?.genre || '').slice(0, 100),
      bpm: Number.isFinite(Number(body?.bpm)) ? Number(body.bpm) : undefined,
      is_explicit: Boolean(body?.is_explicit),
      likes: 0,
      liked_by: [],
      views: 0,
      featured: false,
    });

    return Response.json({ success: true, post });
  } catch (error) {
    console.error('createArtPost error:', error);
    return Response.json({ error: error?.message || 'Could not publish track' }, { status: 500 });
  }
});
