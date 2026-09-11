import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { hasPaidTierAccess, normalizePlan, normalizeStatus } from '../../shared/subscription.ts';

const FREE_FILE_LIMIT = 250 * 1024 * 1024;
const PREMIUM_FILE_LIMIT = 20 * 1024 * 1024 * 1024;
const FILE_TYPES = new Set(['audio', 'image', 'video', 'session', 'document', 'other']);

async function hasLargeUploadAccess(entities: any, userId: string): Promise<boolean> {
  const subscriptions = await entities.Subscription.filter({ user_id: userId });
  const now = new Date().toISOString();
  return subscriptions.some((subscription: any) => (
    normalizePlan(subscription.plan) !== 'free'
    && hasPaidTierAccess(normalizeStatus(subscription.status), {
      currentPeriodEnd: subscription.current_period_end || null,
      trialEndDate: subscription.trial_end_date || null,
      now,
    })
  ));
}

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
    const trusted = TRUSTED_MEDIA_HOSTS.some(
      (host) => hostname === host || hostname.endsWith('.' + host),
    );
    return trusted ? parsed.toString() : '';
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const creationRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'shared_file_create',
      300,
    );
    if (!creationRate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }
    if (user.is_banned) {
      return Response.json({ error: 'banned' }, { status: 403 });
    }
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const body = await req.json();
    const fileUrl = cleanUploadedMediaUrl(body?.file_url);
    if (!body?.name || !fileUrl) {
      return Response.json({ error: 'name and a trusted uploaded file are required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const claimedFileSize = Number(body.file_size || 0);
    if (!Number.isFinite(claimedFileSize) || claimedFileSize < 0) {
      return Response.json({ error: 'file_size must be a non-negative number' }, { status: 400 });
    }

    const storedFileSize = await resolveStoredFileSize(fileUrl);
    if (storedFileSize === null) {
      return Response.json({ error: 'Could not verify uploaded file size' }, { status: 400 });
    }
    const fileSize = storedFileSize;

    if (fileSize > PREMIUM_FILE_LIMIT) {
      return Response.json({ error: 'Files larger than 20GB are not supported' }, { status: 413 });
    }
    if (fileSize > FREE_FILE_LIMIT && !(await hasLargeUploadAccess(entities, user.id))) {
      return Response.json({ error: 'Premium is required for files larger than 250MB' }, { status: 403 });
    }

    const fileType = String(body.file_type || 'other').trim();
    if (!FILE_TYPES.has(fileType)) {
      return Response.json({ error: 'Invalid file type' }, { status: 400 });
    }

    let projectId = body?.project_id ? String(body.project_id) : null;
    let folderId = body?.folder_id ? String(body.folder_id) : null;
    let accessUserIds = [user.id];
    let editUserIds = [user.id];

    if (folderId) {
      const folder = await entities.Folder.get(folderId);
      if (!folder) return Response.json({ error: 'Folder not found' }, { status: 404 });

      let canEditFolder = user.role === 'admin';
      if (!canEditFolder && folder.project_id) {
        const folderProject = await entities.Project.get(folder.project_id).catch(() => null);
        if (!folderProject) return Response.json({ error: 'Project not found' }, { status: 404 });
        canEditFolder = folderProject.owner_id === user.id
          || (folderProject.editor_ids || []).includes(user.id);
      } else if (!canEditFolder) {
        canEditFolder = folder.owner_id === user.id
          || (folder.edit_user_ids || []).includes(user.id);
      }
      if (!canEditFolder) {
        return Response.json({ error: 'Viewer access cannot add files to this folder' }, { status: 403 });
      }

      const folderProjectId = folder.project_id || null;
      if (projectId && folderProjectId !== projectId) {
        return Response.json({ error: 'folder_id does not belong to project_id' }, { status: 400 });
      }

      projectId = folderProjectId;
      accessUserIds = Array.from(new Set([
        ...(folder.access_user_ids || []),
        user.id,
      ].filter(Boolean)));
      editUserIds = Array.from(new Set([
        ...(folder.edit_user_ids || []),
        user.id,
      ].filter(Boolean)));
    } else if (projectId) {
      const project = await entities.Project.get(projectId);
      if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });
      const canEdit = user.role === 'admin'
        || project.owner_id === user.id
        || (project.editor_ids || []).includes(user.id);
      if (!canEdit) {
        return Response.json({ error: 'Viewer access cannot add project files' }, { status: 403 });
      }
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
    }

    const file = await entities.SharedFile.create({
      name: String(body.name).trim().slice(0, 255),
      file_url: fileUrl,
      file_type: fileType,
      file_size: fileSize,
      uploader_id: user.id,
      uploader_name: user.display_name || user.full_name || 'User',
      description: typeof body.description === 'string' ? body.description.slice(0, 1000) : '',
      folder_id: folderId,
      project_id: projectId,
      access_user_ids: accessUserIds,
      edit_user_ids: editUserIds,
    });

    return Response.json({ success: true, file });
  } catch (error) {
    return Response.json({ error: error?.message || 'Could not create shared file' }, { status: 500 });
  }
});
