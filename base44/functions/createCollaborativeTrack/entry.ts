import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { isBase44EntityId } from '../../shared/workflowEvents.ts';
import { acquireProjectMembershipLock, releaseProjectMembershipLock } from '../../shared/projectMembershipLock.ts';

const MAX_TRACK_BYTES = 100 * 1024 * 1024;

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
      'track_create',
      300,
    );
    if (!creationRate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const body = await readJsonBodyLimited(req, 32 * 1024);
    if (typeof body?.project_id !== 'string' || typeof body?.name !== 'string') {
      return Response.json({ error: 'project_id and a non-empty name are required' }, { status: 400 });
    }
    if (body?.file_url != null && typeof body.file_url !== 'string') {
      return Response.json({ error: 'file_url must be a string' }, { status: 400 });
    }
    if (body?.type != null && typeof body.type !== 'string') {
      return Response.json({ error: 'type must be a string' }, { status: 400 });
    }
    if (body?.color != null && typeof body.color !== 'string') {
      return Response.json({ error: 'color must be a string' }, { status: 400 });
    }
    if (body?.muted != null && typeof body.muted !== 'boolean') {
      return Response.json({ error: 'muted must be a boolean' }, { status: 400 });
    }
    if (body?.solo != null && typeof body.solo !== 'boolean') {
      return Response.json({ error: 'solo must be a boolean' }, { status: 400 });
    }
    if (body?.waveform_data != null && !Array.isArray(body.waveform_data)) {
      return Response.json({ error: 'waveform_data must be an array' }, { status: 400 });
    }

    const projectId = body.project_id.trim();
    const name = body.name.trim();
    if (!isBase44EntityId(projectId) || !name) {
      return Response.json({ error: 'project_id and a non-empty name are required' }, { status: 400 });
    }
    if (name.length > 200) {
      return Response.json({ error: 'Track name must be 200 characters or fewer' }, { status: 413 });
    }
    if (typeof body?.color === 'string' && body.color.length > 100) {
      return Response.json({ error: 'Track color must be 100 characters or fewer' }, { status: 413 });
    }
    if (Array.isArray(body?.waveform_data) && body.waveform_data.length > 2000) {
      return Response.json({ error: 'waveform_data supports at most 2000 points' }, { status: 413 });
    }
    if (
      Array.isArray(body?.waveform_data)
      && body.waveform_data.some(
        (point: unknown) => typeof point !== 'number' || !Number.isFinite(point) || point < -1 || point > 1,
      )
    ) {
      return Response.json(
        { error: 'waveform_data points must be numbers between -1 and 1' },
        { status: 400 },
      );
    }

    const volume = Number(body?.volume ?? 75);
    const pan = Number(body?.pan ?? 50);
    const duration = body?.duration == null ? undefined : Number(body.duration);
    if (!Number.isFinite(volume) || volume < 0 || volume > 100) {
      return Response.json({ error: 'Track volume must be between 0 and 100' }, { status: 400 });
    }
    if (!Number.isFinite(pan) || pan < 0 || pan > 100) {
      return Response.json({ error: 'Track pan must be between 0 and 100' }, { status: 400 });
    }
    if (duration !== undefined && (!Number.isFinite(duration) || duration < 0 || duration > 24 * 60 * 60)) {
      return Response.json({ error: 'Invalid track duration' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    let accessUserIds = [user.id];
    let editUserIds = [user.id];

    const initialProject = await entities.Project.get(projectId).catch(() => null);
    if (initialProject) {
      const previewCanEdit = initialProject.owner_id === user.id
        || (initialProject.editor_ids || []).includes(user.id);
      if (!previewCanEdit) {
        return Response.json({ error: 'Viewer access cannot create tracks' }, { status: 403 });
      }
    }
    // Media verification can involve external storage latency. Complete it
    // before taking the project membership lock, then re-check authorization
    // under the lock immediately before creating the track.
    const fileUrl = body?.file_url ? cleanUploadedMediaUrl(body.file_url) : '';
    if (body?.file_url && !fileUrl) {
      return Response.json({ error: 'Track media must come from trusted upload storage' }, { status: 400 });
    }
    if (fileUrl) {
      const storedSize = await resolveStoredFileSize(fileUrl);
      if (storedSize === null) {
        return Response.json({ error: 'Could not verify track media size' }, { status: 400 });
      }
      if (storedSize <= 0 || storedSize > MAX_TRACK_BYTES) {
        return Response.json({ error: 'Track media must be 100MB or smaller' }, { status: 413 });
      }
    }

    const allowedTypes = new Set(['vocal', 'instrument', 'beat', 'sample', 'fx', 'master']);
    if (body?.type != null && !allowedTypes.has(body.type)) {
      return Response.json({ error: 'Invalid track type' }, { status: 400 });
    }

    const projectLockId = initialProject
      ? await acquireProjectMembershipLock(entities, projectId)
      : null;
    if (initialProject && !projectLockId) {
      return Response.json(
        { error: 'Project is being updated. Please retry.' },
        { status: 409 },
      );
    }

    try {
      if (initialProject) {
        const project = await entities.Project.get(projectId).catch(() => null);
        if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

        const canEdit = project.owner_id === user.id || (project.editor_ids || []).includes(user.id);
        if (!canEdit) return Response.json({ error: 'Viewer access cannot create tracks' }, { status: 403 });
        accessUserIds = Array.from(new Set([
          project.owner_id,
          ...(project.collaborator_ids || []),
          user.id,
        ].filter(Boolean)));
        editUserIds = Array.from(new Set([
          project.owner_id,
          ...(project.editor_ids || []),
          user.id,
        ].filter(Boolean)));
      } else {
        // Chat-session tracks use the parent Message ID as project_id.
        const message = await entities.Message.get(projectId).catch(() => null);
        if (!message) {
          return Response.json({ error: 'Project/session not found' }, { status: 404 });
        }
        if (!message?.participant_ids?.includes(user.id)) {
          return Response.json({ error: 'Forbidden' }, { status: 403 });
        }
        accessUserIds = message.participant_ids;
        editUserIds = message.participant_ids;
      }

    const track = await entities.Track.create({
      project_id: projectId,
      name,
      file_url: fileUrl,
      type: body?.type || 'vocal',
      color: body?.color || undefined,
      volume,
      pan,
      muted: body?.muted === true,
      solo: body?.solo === true,
      duration,
      waveform_data: Array.isArray(body.waveform_data)
        ? body.waveform_data
        : undefined,
      uploaded_by: user.id,
      access_user_ids: accessUserIds,
      edit_user_ids: editUserIds,
    });

    return Response.json({ success: true, track });
    } finally {
      await releaseProjectMembershipLock(entities, projectLockId);
    }
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    return Response.json({ error: 'Could not create track' }, { status: 500 });
  }
});
