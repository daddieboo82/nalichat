import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { isBase44EntityId } from '../../shared/workflowEvents.ts';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';

const MAX_PUBLISH_BYTES = 100 * 1024 * 1024;
const ALLOWED_MEDIA = new Set(['original','remix','cover','beat','production','mixing','mastering','collab']);

const TRUSTED_MEDIA_HOSTS = [
  'storage.googleapis.com',
  'base44-user-files.s3.amazonaws.com',
  'base44-user-files.s3.us-east-1.amazonaws.com',
  'files.base44.com',
  'cdn.base44.com',
];

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

function cleanUploadedMediaUrl(value: unknown) {
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

    const publishRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'studio_bounce_publish',
      60,
    );
    if (!publishRate.allowed) {
      return Response.json({ error: 'Publishing rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const body = await readJsonBodyLimited(req, 32 * 1024);
    const projectId = typeof body?.projectId === 'string' ? body.projectId.trim() : '';
    if (body?.projectId != null && !isBase44EntityId(projectId)) {
      return Response.json({ error: 'Invalid projectId' }, { status: 400 });
    }
    if (projectId) {
      const project = await base44.asServiceRole.entities.Project.get(projectId);
      if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });
      const canEdit = project.owner_id === user.id || (project.editor_ids || []).includes(user.id);
      if (!canEdit) {
        return Response.json({ error: 'Viewer access cannot publish this shared project' }, { status: 403 });
      }
    }

    for (const field of ['title', 'description', 'file_url', 'medium', 'genre']) {
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
    const fileUrl = cleanUploadedMediaUrl(body?.file_url);
    const medium = body?.medium || 'original';
    const genre = (body?.genre || '').trim();
    const tags = Array.isArray(body?.tags) ? body.tags : [];

    if (!title || !fileUrl) {
      return Response.json({ error: 'title and a trusted uploaded file are required' }, { status: 400 });
    }
    if (title.length > 200 || description.length > 2000 || genre.length > 100) {
      return Response.json({ error: 'Published track metadata is too long' }, { status: 413 });
    }
    if (!ALLOWED_MEDIA.has(medium)) {
      return Response.json({ error: 'Unsupported media type' }, { status: 400 });
    }
    if (tags.length > 30 || tags.some((tag) => typeof tag !== 'string' || tag.trim().length > 64)) {
      return Response.json({ error: 'Invalid tags' }, { status: 400 });
    }

    const storedSize = await resolveStoredFileSize(fileUrl);
    if (storedSize === null) {
      return Response.json({ error: 'Could not verify published audio size' }, { status: 400 });
    }
    if (storedSize <= 0 || storedSize > MAX_PUBLISH_BYTES) {
      return Response.json({ error: 'Published audio must be 100MB or smaller' }, { status: 413 });
    }

    const bpm = Number(body?.bpm);
    if (body?.bpm != null && (!Number.isFinite(bpm) || bpm <= 0 || bpm > 400)) {
      return Response.json({ error: 'BPM must be between 1 and 400' }, { status: 400 });
    }

    const post = await base44.asServiceRole.entities.ArtPost.create({
      title,
      description,
      file_url: fileUrl,
      medium,
      genre,
      tags: tags.map((tag) => tag.trim()).filter(Boolean),
      is_explicit: body?.is_explicit === true,
      bpm: body?.bpm == null ? undefined : bpm,
      creator_id: user.id,
      creator_name: user.display_name || user.full_name || 'User',
      creator_avatar: user.avatar_url || null,
      featured: false,
      likes: 0,
      views: 0,
    });

    return Response.json({ success: true, post });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    return Response.json({ error: 'Could not publish Studio bounce' }, { status: 500 });
  }
});
