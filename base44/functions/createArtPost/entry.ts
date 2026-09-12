import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

const ALLOWED_MEDIA = new Set(['original','remix','cover','beat','production','mixing','mastering','collab']);
const MAX_PUBLISH_BYTES = 100 * 1024 * 1024;

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

async function resolveStoredFileSize(url: string): Promise<number | null> {
  try {
    const head = await fetch(url, { method: 'HEAD', redirect: 'manual' });
    if (head.ok) {
      const length = Number(head.headers.get('content-length'));
      if (Number.isFinite(length) && length >= 0) return length;
    }
  } catch {}

  try {
    const probe = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      redirect: 'manual',
    });
    if (probe.ok || probe.status === 206) {
      const range = probe.headers.get('content-range') || '';
      const match = range.match(/\/(\d+)$/);
      if (match) {
        const total = Number(match[1]);
        if (Number.isFinite(total) && total >= 0) return total;
      }
      const length = Number(probe.headers.get('content-length'));
      if (Number.isFinite(length) && length >= 0 && probe.status !== 206) return length;
    }
    try { await probe.body?.cancel(); } catch {}
  } catch {}

  return null;
}

function boundedNumber(value: unknown, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
}

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

    const creationRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'art_post_create',
      60,
    );
    if (!creationRate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const body = await readJsonBodyLimited(req, 64 * 1024);
    for (const field of ['title', 'description', 'file_url', 'image_url', 'medium', 'genre']) {
      if (body?.[field] != null && typeof body[field] !== 'string') {
        return Response.json({ error: `${field} must be a string` }, { status: 400 });
      }
    }
    if (body?.tags != null && !Array.isArray(body.tags)) {
      return Response.json({ error: 'tags must be an array' }, { status: 400 });
    }
    if (body?.is_explicit != null && typeof body.is_explicit !== 'boolean') {
      return Response.json({ error: 'is_explicit must be a boolean' }, { status: 400 });
    }

    const title = (body?.title || '').trim();
    const description = (body?.description || '').trim();
    const genre = (body?.genre || '').trim();
    const fileUrl = cleanHttpsUrl(body?.file_url, true);
    if (!title || !fileUrl) {
      return Response.json({ error: 'A title and trusted uploaded media URL are required' }, { status: 400 });
    }
    if (title.length > 200 || description.length > 2000 || genre.length > 100) {
      return Response.json({ error: 'Published track metadata is too long' }, { status: 413 });
    }

    const imageUrl = body?.image_url ? cleanHttpsUrl(body.image_url, true) : '';
    if (body?.image_url && !imageUrl) {
      return Response.json({ error: 'Cover art must come from trusted upload storage' }, { status: 400 });
    }

    const rawTags = Array.isArray(body?.tags) ? body.tags : [];
    if (rawTags.length > 30 || rawTags.some((tag) => typeof tag !== 'string' || tag.trim().length > 64)) {
      return Response.json({ error: 'Invalid tags' }, { status: 400 });
    }

    const medium = body?.medium || 'original';
    if (!ALLOWED_MEDIA.has(medium)) {
      return Response.json({ error: 'Unsupported media type' }, { status: 400 });
    }

    const storedSize = await resolveStoredFileSize(fileUrl);
    if (storedSize === null) {
      return Response.json({ error: 'Could not verify uploaded media size' }, { status: 400 });
    }
    if (storedSize <= 0 || storedSize > MAX_PUBLISH_BYTES) {
      return Response.json({ error: 'Published audio must be 100MB or smaller' }, { status: 413 });
    }

    const post = await base44.asServiceRole.entities.ArtPost.create({
      title,
      description,
      image_url: imageUrl || null,
      file_url: fileUrl,
      medium,
      tags: rawTags.map((tag) => tag.trim()).filter(Boolean),
      creator_id: user.id,
      creator_name: user.display_name || user.full_name || 'User',
      creator_avatar: cleanHttpsUrl(user.avatar_url) || null,
      duration: boundedNumber(body?.duration, 0, 24 * 60 * 60),
      genre,
      bpm: boundedNumber(body?.bpm, 1, 400),
      is_explicit: body?.is_explicit === true,
      likes: 0,
      liked_by: [],
      views: 0,
      featured: false,
    });

    return Response.json({ success: true, post });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('createArtPost error:', error);
    return Response.json({ error: error?.message || 'Could not publish track' }, { status: 500 });
  }
});
