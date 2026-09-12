import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { isBase44EntityId } from '../../shared/workflowEvents.ts';
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
      'shared_file_mutation',
      300,
    );
    if (!writeRate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const body = await readJsonBodyLimited(req, 64 * 1024);
    const fileId = typeof body?.fileId === 'string' ? body.fileId.trim() : '';
    const action = typeof body?.action === 'string' ? body.action : '';
    if (!isBase44EntityId(fileId) || !['update', 'move', 'delete'].includes(action)) {
      return Response.json({ error: 'Valid fileId and action are required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const filePreview = await entities.SharedFile.get(fileId).catch(() => null);
    if (!filePreview) return Response.json({ error: 'File not found' }, { status: 404 });
    if (filePreview.project_id && !isBase44EntityId(filePreview.project_id)) {
      return Response.json({ error: 'File has an invalid project reference' }, { status: 409 });
    }

    let previewCanEdit = user.role === 'admin';
    if (!previewCanEdit && filePreview.project_id) {
      const projectPreview = await entities.Project.get(filePreview.project_id).catch(() => null);
      if (!projectPreview) return Response.json({ error: 'Project not found' }, { status: 404 });
      previewCanEdit = projectPreview.owner_id === user.id || (projectPreview.editor_ids || []).includes(user.id);
    } else if (!previewCanEdit) {
      previewCanEdit = filePreview.uploader_id === user.id
        || (filePreview.edit_user_ids || []).includes(user.id);
    }
    if (!previewCanEdit) {
      return Response.json({ error: 'Viewer access cannot modify this file' }, { status: 403 });
    }

    const lockId = await acquireSharedFileMutationLock(entities, fileId);
    if (!lockId) {
      return Response.json(
        { error: 'File is being updated. Please retry.' },
        { status: 409 },
      );
    }

    try {
    let file = await entities.SharedFile.get(fileId);
    if (!file) return Response.json({ error: 'File not found' }, { status: 404 });
    if ((file.project_id || null) !== (filePreview.project_id || null)) {
      return Response.json({ error: 'File project changed. Please retry.' }, { status: 409 });
    }
    if (file.project_id && !isBase44EntityId(file.project_id)) {
      return Response.json({ error: 'File has an invalid project reference' }, { status: 409 });
    }

    const projectLockIds: string[] = [];
    const acquireProjectLock = async (projectId: string | null | undefined) => {
      if (!projectId) return true;
      if (projectLockIds.some((id) => id === `project_membership_lock_${projectId}`)) return true;
      const projectLockId = await acquireProjectMembershipLock(entities, projectId);
      if (!projectLockId) return false;
      projectLockIds.push(projectLockId);
      return true;
    };

    try {
      if (file.project_id) {
        const locked = await acquireProjectLock(file.project_id);
        if (!locked) {
          return Response.json(
            { error: 'Project is being updated. Please retry.' },
            { status: 409 },
          );
        }
        const currentFile = await entities.SharedFile.get(fileId).catch(() => null);
        if (!currentFile) return Response.json({ error: 'File not found' }, { status: 404 });
        if (currentFile.project_id !== file.project_id) {
          return Response.json({ error: 'File project changed. Please retry.' }, { status: 409 });
        }
        file = currentFile;
      }

    let canEdit = user.role === 'admin';
    if (!canEdit && file.project_id) {
      const project = await entities.Project.get(file.project_id).catch(() => null);
      if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });
      canEdit = project.owner_id === user.id || (project.editor_ids || []).includes(user.id);
    } else if (!canEdit) {
      canEdit = file.uploader_id === user.id || (file.edit_user_ids || []).includes(user.id);
    }
    if (!canEdit) return Response.json({ error: 'Viewer access cannot modify this file' }, { status: 403 });

    if (action === 'delete') {
      await entities.SharedFile.delete(file.id);
      return Response.json({ success: true, deleted: true });
    }

    if (action === 'update') {
      const patch: Record<string, any> = {};

      if (body?.name !== undefined) {
        if (typeof body.name !== 'string') {
          return Response.json({ error: 'File name must be a string' }, { status: 400 });
        }
        const name = body.name.trim();
        if (!name) return Response.json({ error: 'File name cannot be empty' }, { status: 400 });
        if (name.length > 255) {
          return Response.json({ error: 'File name must be 255 characters or fewer' }, { status: 413 });
        }
        patch.name = name;
      }

      if (body?.description !== undefined) {
        if (typeof body.description !== 'string') {
          return Response.json({ error: 'File description must be a string' }, { status: 400 });
        }
        if (body.description.length > 1000) {
          return Response.json({ error: 'File description must be 1000 characters or fewer' }, { status: 413 });
        }
        patch.description = body.description;
      }

      if (body?.tags !== undefined) {
        if (!Array.isArray(body.tags)) {
          return Response.json({ error: 'tags must be an array' }, { status: 400 });
        }
        if (body.tags.length > 50) {
          return Response.json({ error: 'Files support at most 50 tags' }, { status: 413 });
        }
        if (body.tags.some((tag: unknown) => typeof tag !== 'string' || tag.trim().length > 64)) {
          return Response.json({ error: 'Each tag must be a string of 64 characters or fewer' }, { status: 400 });
        }
        patch.tags = Array.from(new Set(
          body.tags.map((tag: string) => tag.trim()).filter(Boolean),
        ));
      }

      if (Object.keys(patch).length === 0) {
        return Response.json({ error: 'No supported file fields supplied' }, { status: 400 });
      }
      const updated = await entities.SharedFile.update(file.id, patch);
      return Response.json({ success: true, file: updated });
    }

    if (body?.folderId != null && typeof body.folderId !== 'string') {
      return Response.json({ error: 'folderId must be a string or null' }, { status: 400 });
    }
    const folderId = typeof body?.folderId === 'string' ? body.folderId.trim() : null;
    if (folderId && !isBase44EntityId(folderId)) {
      return Response.json({ error: 'Valid folderId is required' }, { status: 400 });
    }
    let projectId = null;
    let accessUserIds = [file.uploader_id].filter(Boolean);
    let editUserIds = [file.uploader_id].filter(Boolean);

    if (folderId) {
      let folder = await entities.Folder.get(folderId);
      if (!folder) return Response.json({ error: 'Folder not found' }, { status: 404 });
      if (folder.project_id && !isBase44EntityId(folder.project_id)) {
        return Response.json({ error: 'Folder has an invalid project reference' }, { status: 409 });
      }

      if (folder.project_id && folder.project_id !== file.project_id) {
        const locked = await acquireProjectLock(folder.project_id);
        if (!locked) {
          return Response.json(
            { error: 'Destination project is being updated. Please retry.' },
            { status: 409 },
          );
        }
        const currentFolder = await entities.Folder.get(folderId).catch(() => null);
        if (!currentFolder) return Response.json({ error: 'Folder not found' }, { status: 404 });
        if (
          currentFolder.project_id !== folder.project_id
          || (currentFolder.project_id && !isBase44EntityId(currentFolder.project_id))
        ) {
          return Response.json({ error: 'Folder destination changed. Please retry.' }, { status: 409 });
        }
        folder = currentFolder;
      }

      let canUseFolder = user.role === 'admin';
      if (!canUseFolder && folder.project_id) {
        const targetProject = await entities.Project.get(folder.project_id).catch(() => null);
        if (!targetProject) return Response.json({ error: 'Project not found' }, { status: 404 });
        canUseFolder = targetProject.owner_id === user.id || (targetProject.editor_ids || []).includes(user.id);
      } else if (!canUseFolder) {
        canUseFolder = folder.owner_id === user.id || (folder.edit_user_ids || []).includes(user.id);
      }
      if (!canUseFolder) {
        return Response.json({ error: 'You cannot move files into this folder' }, { status: 403 });
      }

      projectId = folder.project_id || null;
      accessUserIds = Array.from(new Set(folder.access_user_ids || []));
      editUserIds = Array.from(new Set(folder.edit_user_ids || []));
    }

    if (file.project_id && projectId !== file.project_id && user.role !== 'admin') {
      return Response.json({
        error: 'Project files cannot be moved outside their current project. Copy or share the file instead.',
      }, { status: 403 });
    }

    const updated = await entities.SharedFile.update(file.id, {
      folder_id: folderId,
      project_id: projectId,
      access_user_ids: accessUserIds,
      edit_user_ids: editUserIds,
      share_token_hash: null,
      share_token_expires_at: null,
    });
    return Response.json({ success: true, file: updated });
    } finally {
      for (const projectLockId of projectLockIds.reverse()) {
        await releaseProjectMembershipLock(entities, projectLockId);
      }
    }
    } finally {
      await releaseSharedFileMutationLock(entities, lockId);
    }
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('mutateSharedFile error:', error);
    return Response.json({ error: 'File mutation failed' }, { status: 500 });
  }
});
