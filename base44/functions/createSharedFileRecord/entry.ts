import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { resolveUserSubscription } from '../../shared/subscriptionAccess.ts';
import { acquireProjectMembershipLock, releaseProjectMembershipLock } from '../../shared/projectMembershipLock.ts';

const FREE_FILE_LIMIT = 250 * 1024 * 1024;
const PREMIUM_FILE_LIMIT = 20 * 1024 * 1024 * 1024;
const FILE_TYPES = new Set(['audio', 'image', 'video', 'session', 'document', 'other']);

async function hasLargeUploadAccess(entities: any, userId: string): Promise<boolean> {
  const access = await resolveUserSubscription(entities.Subscription, userId);
  return access.hasPaidAccess;
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
      'shared_file_create',
      300,
    );
    if (!creationRate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const body = await readJsonBodyLimited(req, 64 * 1024);
    if (typeof body?.name !== 'string' || typeof body?.file_url !== 'string') {
      return Response.json({ error: 'name and a trusted uploaded file are required' }, { status: 400 });
    }
    if (body?.description != null && typeof body.description !== 'string') {
      return Response.json({ error: 'description must be a string' }, { status: 400 });
    }
    if (body?.file_type != null && typeof body.file_type !== 'string') {
      return Response.json({ error: 'file_type must be a string' }, { status: 400 });
    }
    if (body?.project_id != null && typeof body.project_id !== 'string') {
      return Response.json({ error: 'project_id must be a string or null' }, { status: 400 });
    }
    if (body?.folder_id != null && typeof body.folder_id !== 'string') {
      return Response.json({ error: 'folder_id must be a string or null' }, { status: 400 });
    }
    if (body?.file_size != null && typeof body.file_size !== 'number') {
      return Response.json({ error: 'file_size must be a non-negative number' }, { status: 400 });
    }

    const name = body.name.trim();
    const description = typeof body.description === 'string' ? body.description : '';
    const fileUrl = cleanUploadedMediaUrl(body.file_url);
    if (!name || !fileUrl) {
      return Response.json({ error: 'name and a trusted uploaded file are required' }, { status: 400 });
    }
    if (name.length > 255) {
      return Response.json({ error: 'name must be 255 characters or fewer' }, { status: 413 });
    }
    if (description.length > 1000) {
      return Response.json({ error: 'description must be 1000 characters or fewer' }, { status: 413 });
    }

    const entities = base44.asServiceRole.entities;
    const claimedFileSize = body.file_size == null ? 0 : body.file_size;
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

    const fileType = typeof body.file_type === 'string' ? body.file_type.trim() : 'other';
    if (!FILE_TYPES.has(fileType)) {
      return Response.json({ error: 'Invalid file type' }, { status: 400 });
    }

    let projectId = typeof body?.project_id === 'string' ? body.project_id.trim() : null;
    let folderId = typeof body?.folder_id === 'string' ? body.folder_id.trim() : null;
    if (projectId && projectId.length > 200) {
      return Response.json({ error: 'project_id is too long' }, { status: 400 });
    }
    if (folderId && folderId.length > 200) {
      return Response.json({ error: 'folder_id is too long' }, { status: 400 });
    }
    let accessUserIds = [user.id];
    let editUserIds = [user.id];

    // Resolve the destination project first, then serialize the final
    // authorization + create against project deletion/membership changes.
    let destinationProjectId = projectId;
    if (folderId) {
      const folder = await entities.Folder.get(folderId);
      if (!folder) return Response.json({ error: 'Folder not found' }, { status: 404 });
      const folderProjectId = folder.project_id || null;
      if (projectId && folderProjectId !== projectId) {
        return Response.json({ error: 'folder_id does not belong to project_id' }, { status: 400 });
      }
      destinationProjectId = folderProjectId;
    }

    const projectLockId = destinationProjectId
      ? await acquireProjectMembershipLock(entities, destinationProjectId)
      : null;
    if (destinationProjectId && !projectLockId) {
      return Response.json(
        { error: 'Project is being updated. Please retry.' },
        { status: 409 },
      );
    }

    try {
      if (folderId) {
        const folder = await entities.Folder.get(folderId);
        if (!folder) return Response.json({ error: 'Folder not found' }, { status: 404 });
        if ((folder.project_id || null) !== (destinationProjectId || null)) {
          return Response.json({ error: 'Folder destination changed. Please retry.' }, { status: 409 });
        }

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

        projectId = folder.project_id || null;
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
        name,
        file_url: fileUrl,
        file_type: fileType,
        file_size: fileSize,
        uploader_id: user.id,
        uploader_name: user.display_name || user.full_name || 'User',
        description,
        folder_id: folderId,
        project_id: projectId,
        access_user_ids: accessUserIds,
        edit_user_ids: editUserIds,
      });

      return Response.json({ success: true, file });
    } finally {
      await releaseProjectMembershipLock(entities, projectLockId);
    }
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    return Response.json({ error: 'Could not create shared file' }, { status: 500 });
  }
});
