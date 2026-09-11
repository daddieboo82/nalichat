import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const fileId = String(body?.fileId || '');
    const action = body?.action;
    if (!fileId || !['update', 'move', 'delete'].includes(action)) {
      return Response.json({ error: 'Valid fileId and action are required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const file = await entities.SharedFile.get(fileId);
    if (!file) return Response.json({ error: 'File not found' }, { status: 404 });

    const canEdit = user.role === 'admin' || (file.edit_user_ids || []).includes(user.id);
    if (!canEdit) return Response.json({ error: 'Viewer access cannot modify this file' }, { status: 403 });

    if (action === 'delete') {
      await entities.SharedFile.delete(file.id);
      return Response.json({ success: true, deleted: true });
    }

    if (action === 'update') {
      const patch: Record<string, any> = {};
      if (typeof body?.name === 'string') patch.name = body.name.slice(0, 255);
      if (typeof body?.description === 'string') patch.description = body.description.slice(0, 1000);
      if (Array.isArray(body?.tags)) patch.tags = body.tags.map((t) => String(t).slice(0, 64)).slice(0, 50);
      const updated = await entities.SharedFile.update(file.id, patch);
      return Response.json({ success: true, file: updated });
    }

    const folderId = body?.folderId || null;
    let projectId = null;
    let accessUserIds = [file.uploader_id].filter(Boolean);
    let editUserIds = [file.uploader_id].filter(Boolean);

    if (folderId) {
      const folder = await entities.Folder.get(folderId);
      if (!folder || !(folder.edit_user_ids || []).includes(user.id) && user.role !== 'admin') {
        return Response.json({ error: 'You cannot move files into this folder' }, { status: 403 });
      }
      projectId = folder.project_id || null;
      accessUserIds = Array.from(new Set(folder.access_user_ids || []));
      editUserIds = Array.from(new Set(folder.edit_user_ids || []));
    }

    const updated = await entities.SharedFile.update(file.id, {
      folder_id: folderId,
      project_id: projectId,
      access_user_ids: accessUserIds,
      edit_user_ids: editUserIds,
      share_token_hash: null,
    });
    return Response.json({ success: true, file: updated });
  } catch (error) {
    return Response.json({ error: error?.message || 'File mutation failed' }, { status: 500 });
  }
});
