import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { acquireSharedFileMutationLock, releaseSharedFileMutationLock } from '../../shared/sharedFileMutationLock.ts';
import { acquireProjectMembershipLock, releaseProjectMembershipLock } from '../../shared/projectMembershipLock.ts';

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
      'folder_delete',
      120,
    );
    if (!writeRate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const { folderId } = await readJsonBodyLimited(req, 64 * 1024);
    if (typeof folderId !== 'string' || !folderId.trim() || folderId.length > 200) {
      return Response.json({ error: 'folderId is required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    let folder = await entities.Folder.get(folderId);
    if (!folder) return Response.json({ error: 'Folder not found' }, { status: 404 });

    let previewCanEdit = user.role === 'admin';
    if (!previewCanEdit && folder.project_id) {
      const projectPreview = await entities.Project.get(folder.project_id).catch(() => null);
      if (!projectPreview) return Response.json({ error: 'Project not found' }, { status: 404 });
      previewCanEdit = projectPreview.owner_id === user.id || (projectPreview.editor_ids || []).includes(user.id);
    } else if (!previewCanEdit) {
      previewCanEdit = folder.owner_id === user.id;
    }
    if (!previewCanEdit) {
      return Response.json({ error: 'You cannot delete this folder' }, { status: 403 });
    }

    const projectLockId = folder.project_id
      ? await acquireProjectMembershipLock(entities, folder.project_id)
      : null;
    if (folder.project_id && !projectLockId) {
      return Response.json(
        { error: 'Project is being updated. Please retry.' },
        { status: 409 },
      );
    }

    try {
      const currentFolder = await entities.Folder.get(folderId).catch(() => null);
      if (!currentFolder) return Response.json({ error: 'Folder not found' }, { status: 404 });
      if ((currentFolder.project_id || null) !== (folder.project_id || null)) {
        return Response.json({ error: 'Folder project changed. Please retry.' }, { status: 409 });
      }
      folder = currentFolder;

      let canEdit = user.role === 'admin';
      if (!canEdit && folder.project_id) {
        const project = await entities.Project.get(folder.project_id).catch(() => null);
        if (!project) {
          return Response.json({ error: 'Project not found' }, { status: 404 });
        }
        canEdit = project.owner_id === user.id || (project.editor_ids || []).includes(user.id);
      } else if (!canEdit) {
        canEdit = folder.owner_id === user.id;
      }
      if (!canEdit) {
        return Response.json({ error: 'You cannot delete this folder' }, { status: 403 });
      }

    let detachedFiles = 0;
    while (true) {
      const files = await entities.SharedFile.filter(
        { folder_id: folder.id },
        '-created_date',
        200,
      );
      if (files.length === 0) break;

      for (const file of files) {
        const fileLockId = await acquireSharedFileMutationLock(entities, file.id);
        if (!fileLockId) {
          return Response.json(
            { error: 'A file in this folder is being updated. Please retry.' },
            { status: 409 },
          );
        }

        try {
          const current = await entities.SharedFile.get(file.id).catch(() => null);
          if (current?.folder_id === folder.id) {
            await entities.SharedFile.update(file.id, { folder_id: null });
            detachedFiles += 1;
          }
        } finally {
          await releaseSharedFileMutationLock(entities, fileLockId);
        }
      }

      if (files.length < 200) break;
    }

    await entities.Folder.delete(folder.id);
    return Response.json({
      success: true,
      deleted: true,
      detached_files: detachedFiles,
    });
    } finally {
      await releaseProjectMembershipLock(entities, projectLockId);
    }
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('deleteFolder error:', error);
    return Response.json({ error: 'Folder deletion failed' }, { status: 500 });
  }
});
