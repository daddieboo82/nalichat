import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const ALLOWED_MEDIA = new Set(['original','remix','cover','beat','production','mixing','mastering','collab']);

const TRUSTED_MEDIA_HOSTS = [
  'storage.googleapis.com',
  'base44-user-files.s3.amazonaws.com',
  'base44-user-files.s3.us-east-1.amazonaws.com',
  'files.base44.com',
  'cdn.base44.com',
];

function cleanHttpsUrl(value: unknown, requireTrustedHost = false) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return '';
    const hostname = parsed.hostname.toLowerCase();
    if (requireTrustedHost) {
      const trusted = TRUSTED_MEDIA_HOSTS.some(
        (host) => hostname === host || hostname.endsWith('.' + host),
      );
      if (!trusted) return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

function boundedNumber(value: unknown, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const title = String(body?.title || '').trim().slice(0, 200);
    const fileUrl = cleanHttpsUrl(body?.file_url, true);
    if (!title || !fileUrl) {
      return Response.json({ error: 'A title and trusted uploaded media URL are required' }, { status: 400 });
    }

    const imageUrl = body?.image_url ? cleanHttpsUrl(body.image_url, true) : '';
    if (body?.image_url && !imageUrl) {
      return Response.json({ error: 'Cover art must come from trusted upload storage' }, { status: 400 });
    }

    const medium = ALLOWED_MEDIA.has(body?.medium) ? body.medium : 'original';

    const post = await base44.asServiceRole.entities.ArtPost.create({
      title,
      description: String(body?.description || '').slice(0, 2000),
      image_url: imageUrl || null,
      file_url: fileUrl,
      medium,
      tags: Array.isArray(body?.tags)
        ? body.tags
            .map((tag: any) => String(tag).trim().slice(0, 64))
            .filter(Boolean)
            .slice(0, 30)
        : [],
      creator_id: user.id,
      creator_name: user.display_name || user.full_name || 'User',
      creator_avatar: cleanHttpsUrl(user.avatar_url) || null,
      duration: boundedNumber(body?.duration, 0, 24 * 60 * 60),
      genre: String(body?.genre || '').trim().slice(0, 100),
      bpm: boundedNumber(body?.bpm, 1, 400),
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
