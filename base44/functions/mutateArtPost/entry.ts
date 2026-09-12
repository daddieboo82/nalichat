import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { isBase44EntityId } from '../../shared/workflowEvents.ts';
import {
  acquireArtPostEngagementLock,
  releaseArtPostEngagementLock,
} from '../../shared/artPostEngagementLock.ts';

const ALLOWED_MEDIA = new Set(['original','remix','cover','beat','production','mixing','mastering','collab']);
const TRUSTED_MEDIA_HOSTS = [
  'storage.googleapis.com',
  'base44-user-files.s3.amazonaws.com',
  'base44-user-files.s3.us-east-1.amazonaws.com',
  'files.base44.com',
  'cdn.base44.com',
];

function cleanCoverUrl(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return '';
    const hostname = parsed.hostname.toLowerCase();
    const trusted = TRUSTED_MEDIA_HOSTS.some(
      (host) => hostname === host || hostname.endsWith('.' + host),
    );
    return trusted ? parsed.toString() : '';
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

    const writeRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'artpost_mutation',
      300,
    );
    if (!writeRate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const body = await readJsonBodyLimited(req, 32 * 1024);
    const postId = String(body?.postId || '').trim();
    if (!isBase44EntityId(postId)) {
      return Response.json({ error: 'Valid postId is required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const post = await entities.ArtPost.get(postId);
    if (!post) return Response.json({ error: 'Post not found' }, { status: 404 });
    if (post.creator_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const patch: Record<string, unknown> = {};
    if (body?.title !== undefined) {
      const title = String(body.title || '').trim().slice(0, 200);
      if (!title) return Response.json({ error: 'Title is required' }, { status: 400 });
      patch.title = title;
    }
    if (body?.description !== undefined) patch.description = String(body.description || '').slice(0, 2000);
    if (body?.image_url !== undefined) {
      const imageUrl = body.image_url ? cleanCoverUrl(body.image_url) : '';
      if (body.image_url && !imageUrl) {
        return Response.json({ error: 'Cover art must come from trusted upload storage' }, { status: 400 });
      }
      patch.image_url = imageUrl || null;
    }
    if (body?.medium !== undefined) {
      if (!ALLOWED_MEDIA.has(body.medium)) return Response.json({ error: 'Invalid medium' }, { status: 400 });
      patch.medium = body.medium;
    }
    if (body?.tags !== undefined) {
      patch.tags = Array.isArray(body.tags)
        ? body.tags.map((tag: unknown) => String(tag || '').trim().slice(0, 64)).filter(Boolean).slice(0, 30)
        : [];
    }
    if (body?.genre !== undefined) patch.genre = String(body.genre || '').trim().slice(0, 100);
    if (body?.bpm !== undefined) {
      const bpm = boundedNumber(body.bpm, 1, 400);
      if (bpm === undefined) return Response.json({ error: 'Invalid BPM' }, { status: 400 });
      patch.bpm = bpm;
    }
    if (body?.duration !== undefined) {
      const duration = boundedNumber(body.duration, 0, 24 * 60 * 60);
      if (duration === undefined) return Response.json({ error: 'Invalid duration' }, { status: 400 });
      patch.duration = duration;
    }
    if (body?.is_explicit !== undefined) patch.is_explicit = Boolean(body.is_explicit);

    if (Object.keys(patch).length === 0) {
      return Response.json({ error: 'No supported ArtPost fields supplied' }, { status: 400 });
    }

    const lockId = await acquireArtPostEngagementLock(entities, postId);
    if (!lockId) {
      return Response.json({ error: 'Post is being updated. Please retry.' }, { status: 409 });
    }

    try {
      const currentPost = await entities.ArtPost.get(postId).catch(() => null);
      if (!currentPost) return Response.json({ error: 'Post not found' }, { status: 404 });
      if (currentPost.creator_id !== user.id && user.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }

      const updated = await entities.ArtPost.update(currentPost.id, patch);
      return Response.json({ success: true, post: updated });
    } finally {
      await releaseArtPostEngagementLock(entities, lockId);
    }
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('mutateArtPost error:', error);
    return Response.json({ error: 'ArtPost update failed' }, { status: 500 });
  }
});
