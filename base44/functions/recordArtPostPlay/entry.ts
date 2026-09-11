import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

async function playId(postId: string, listenerId: string, day: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${postId}:${listenerId}:${day}`),
  );
  const suffix = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `art_post_play_${suffix}`;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) {
      return Response.json({ counted: false, reason: 'anonymous' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const postId = String(body?.post_id || '').trim();
    if (!postId) return Response.json({ error: 'post_id is required' }, { status: 400 });

    const entities = base44.asServiceRole.entities;
    const post = await entities.ArtPost.get(postId);
    if (!post) return Response.json({ error: 'Track not found' }, { status: 404 });
    if (post.creator_id === user.id) {
      return Response.json({ counted: false, reason: 'creator_self_play', views: Number(post.views || 0) });
    }

    const day = new Date().toISOString().slice(0, 10);
    const id = await playId(postId, user.id, day);
    try {
      await entities.ArtPostPlay.create({
        id,
        post_id: postId,
        listener_id: user.id,
        play_day: day,
      });
    } catch (error) {
      const existing = await entities.ArtPostPlay.filter({
        post_id: postId,
        listener_id: user.id,
        play_day: day,
      });
      if (existing.length > 0) {
        return Response.json({ counted: false, reason: 'already_counted_today', views: Number(post.views || 0) });
      }
      throw error;
    }

    await entities.ArtPost.updateMany({ id: postId }, { $inc: { views: 1 } });
    const updated = await entities.ArtPost.get(postId);
    return Response.json({ counted: true, views: Number(updated?.views || 0) });
  } catch (error) {
    console.error('recordArtPostPlay error:', error);
    return Response.json({ error: error?.message || 'Could not record play' }, { status: 500 });
  }
}
