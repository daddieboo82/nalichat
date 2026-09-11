import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

const TRUSTED_MEDIA_HOSTS = [
  'storage.googleapis.com',
  'base44-user-files.s3.amazonaws.com',
  'base44-user-files.s3.us-east-1.amazonaws.com',
  'files.base44.com',
  'cdn.base44.com',
];

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
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const creationRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'track_create',
      300,
    );
    if (!creationRate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }
    if (user.is_banned) {
      return Response.json({ error: 'banned' }, { status: 403 });
    }

    const body = await req.json();
    const projectId = String(body?.project_id || '');
    const name = String(body?.name || '').trim().slice(0, 200);
    if (!projectId || !name) {
      return Response.json({ error: 'project_id and a non-empty name are required' }, { status: 400 });
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

    const project = await entities.Project.get(projectId).catch(() => null);
    if (project) {
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

    const fileUrl = body?.file_url ? cleanUploadedMediaUrl(body.file_url) : '';
    if (body?.file_url && !fileUrl) {
      return Response.json({ error: 'Track media must come from trusted upload storage' }, { status: 400 });
    }

    const allowedTypes = new Set(['vocal', 'instrument', 'beat', 'sample', 'fx', 'master']);
    const track = await entities.Track.create({
      project_id: projectId,
      name,
      file_url: fileUrl,
      type: allowedTypes.has(body.type) ? body.type : 'vocal',
      color: typeof body.color === 'string' ? body.color.slice(0, 100) : undefined,
      volume,
      pan,
      muted: Boolean(body.muted),
      solo: Boolean(body.solo),
      duration,
      waveform_data: Array.isArray(body.waveform_data)
        ? body.waveform_data
            .map((point: unknown) => Number(point))
            .filter((point: number) => Number.isFinite(point) && point >= -1 && point <= 1)
            .slice(0, 2000)
        : undefined,
      uploaded_by: user.id,
      access_user_ids: accessUserIds,
      edit_user_ids: editUserIds,
    });

    return Response.json({ success: true, track });
  } catch (error) {
    return Response.json({ error: error?.message || 'Could not create track' }, { status: 500 });
  }
});
