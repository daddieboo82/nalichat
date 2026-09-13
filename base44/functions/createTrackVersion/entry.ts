import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { isBase44EntityId } from '../../shared/workflowEvents.ts';
import { acquireTrackLifecycleLock, releaseTrackLifecycleLock } from '../../shared/trackLifecycleLock.ts';

const MAX_TRACK_VERSION_BYTES = 100 * 1024 * 1024;

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
    return TRUSTED_MEDIA_HOSTS.some(
      (host) => hostname === host || hostname.endsWith('.' + host),
    ) ? parsed.toString() : '';
  } catch {
    return '';
  }
}

async function versionId(trackId: string, versionNumber: number) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${trackId}:${versionNumber}`),
  );
  const suffix = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `track_version_${suffix}`;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    if (user.is_banned) {
      return Response.json({ error: 'banned' }, { status: 403 });
    }

    const body = await readJsonBodyLimited(req, 64 * 1024);
    if (
      typeof body?.track_id !== 'string'
      || typeof body?.project_id !== 'string'
      || !isBase44EntityId(body.track_id.trim())
      || !isBase44EntityId(body.project_id.trim())
    ) {
      return Response.json({ error: 'track_id and project_id are required' }, { status: 400 });
    }
    if (body?.label != null && typeof body.label !== 'string') {
      return Response.json({ error: 'label must be a string' }, { status: 400 });
    }
    if (typeof body?.label === 'string' && body.label.length > 200) {
      return Response.json({ error: 'label must be 200 characters or fewer' }, { status: 413 });
    }
    if (body?.file_url != null && typeof body.file_url !== 'string') {
      return Response.json({ error: 'file_url must be a string' }, { status: 400 });
    }
    if (body?.muted != null && typeof body.muted !== 'boolean') {
      return Response.json({ error: 'muted must be a boolean' }, { status: 400 });
    }
    if (body?.solo != null && typeof body.solo !== 'boolean') {
      return Response.json({ error: 'solo must be a boolean' }, { status: 400 });
    }

    const trackId = body.track_id.trim();
    const projectId = body.project_id.trim();
    const entities = base44.asServiceRole.entities;
    const rate = await consumeHourlyLimit(entities, user.id, 'track_version_create', 120);
    if (!rate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const [projectPreview, trackPreview] = await Promise.all([
      entities.Project.get(projectId).catch(() => null),
      entities.Track.get(trackId).catch(() => null),
    ]);
    if (!projectPreview || !trackPreview || trackPreview.project_id !== projectPreview.id) {
      return Response.json({ error: 'Project/track not found' }, { status: 404 });
    }
    const previewCanEdit = projectPreview.owner_id === user.id
      || (projectPreview.editor_ids || []).includes(user.id);
    if (!previewCanEdit) {
      return Response.json({ error: 'Viewer access cannot save versions' }, { status: 403 });
    }

    // Remote storage verification can be slow, so perform it before acquiring
    // the track lifecycle lock. Authorization and track/project freshness are
    // rechecked under the lock before the version record is created.
    const previewInheritedFileUrl = trackPreview.file_url ? cleanUploadedMediaUrl(trackPreview.file_url) : '';
    const previewFallbackFileUrl = body?.file_url ? cleanUploadedMediaUrl(body.file_url) : '';
    if ((trackPreview.file_url && !previewInheritedFileUrl) || (body?.file_url && !previewFallbackFileUrl)) {
      return Response.json({ error: 'Track version media must come from trusted upload storage' }, { status: 400 });
    }
    const verifiedVersionFileUrl = previewInheritedFileUrl || previewFallbackFileUrl;
    if (verifiedVersionFileUrl) {
      const storedSize = await resolveStoredFileSize(verifiedVersionFileUrl);
      if (storedSize === null) {
        return Response.json({ error: 'Could not verify track version media size' }, { status: 400 });
      }
      if (storedSize <= 0 || storedSize > MAX_TRACK_VERSION_BYTES) {
        return Response.json({ error: 'Track version media must be 100MB or smaller' }, { status: 413 });
      }
    }

    const lockId = await acquireTrackLifecycleLock(entities, trackId);
    if (!lockId) {
      return Response.json({ error: 'Track is being updated. Please retry.' }, { status: 409 });
    }

    try {
    const [project, track] = await Promise.all([
      entities.Project.get(projectId),
      entities.Track.get(trackId),
    ]);
    if (!project || !track || track.project_id !== project.id) {
      return Response.json({ error: 'Project/track not found' }, { status: 404 });
    }
    const canEdit = project.owner_id === user.id || (project.editor_ids || []).includes(user.id);
    if (!canEdit) return Response.json({ error: 'Viewer access cannot save versions' }, { status: 403 });

    let versions = await entities.TrackVersion.filter({ track_id: track.id }, '-version_number', 1);
    let nextNum = (versions[0]?.version_number || 0) + 1;

    const volume = Number(body?.volume ?? track.volume ?? 75);
    const pan = Number(body?.pan ?? track.pan ?? 50);
    if (!Number.isFinite(volume) || volume < 0 || volume > 100) {
      return Response.json({ error: 'Version volume must be between 0 and 100' }, { status: 400 });
    }
    if (!Number.isFinite(pan) || pan < 0 || pan > 100) {
      return Response.json({ error: 'Version pan must be between 0 and 100' }, { status: 400 });
    }

    const inheritedFileUrl = track.file_url ? cleanUploadedMediaUrl(track.file_url) : '';
    const fallbackFileUrl = body?.file_url ? cleanUploadedMediaUrl(body.file_url) : '';
    if ((track.file_url && !inheritedFileUrl) || (body?.file_url && !fallbackFileUrl)) {
      return Response.json({ error: 'Track version media must come from trusted upload storage' }, { status: 400 });
    }
    const versionFileUrl = inheritedFileUrl || fallbackFileUrl;
    // If the track's media changed between preview and lock acquisition, avoid
    // using media that was not verified by this request.
    if (versionFileUrl !== verifiedVersionFileUrl) {
      return Response.json({ error: 'Track media changed. Please retry saving the version.' }, { status: 409 });
    }

    let version = null;
    for (let attempt = 0; attempt < 5 && !version; attempt += 1) {
      const id = await versionId(track.id, nextNum);
      try {
        version = await entities.TrackVersion.create({
          id,
          track_id: track.id,
          project_id: project.id,
          version_number: nextNum,
          label: typeof body?.label === 'string' && body.label.trim()
            ? body.label.trim()
            : `Version ${nextNum}`,
          file_url: versionFileUrl,
          volume,
          pan,
          muted: body.muted ?? track.muted,
          solo: body.solo ?? track.solo,
          saved_by_id: user.id,
          saved_by_name: user.display_name || user.full_name || 'User',
          access_user_ids: Array.from(new Set([
            project.owner_id,
            ...(project.collaborator_ids || []),
          ].filter(Boolean))),
          edit_user_ids: Array.from(new Set([
            project.owner_id,
            ...(project.editor_ids || []),
          ].filter(Boolean))),
        });
      } catch (createError) {
        versions = await entities.TrackVersion.filter({ track_id: track.id }, '-version_number', 1);
        const latest = Number(versions[0]?.version_number || 0);
        if (latest < nextNum) throw createError;
        nextNum = latest + 1;
      }
    }

    if (!version) {
      return Response.json({ error: 'Could not allocate a unique version number' }, { status: 409 });
    }

    return Response.json({ success: true, action: 'create_track_version', userId: user.id, projectId: project.id, trackId: track.id, versionId: version.id, version });
    } finally {
      await releaseTrackLifecycleLock(entities, lockId);
    }
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    return Response.json({ error: 'Could not save track version' }, { status: 500 });
  }
});
