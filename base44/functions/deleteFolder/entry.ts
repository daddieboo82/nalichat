import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { folderId } = await req.json();
    if (!folderId) return Response.json({ error: 'folderId is required' }, { status: 400 });

    const entities = base44.asServiceRole.entities;
    const folder = await entities.Folder.get(String(folderId));
    if (!folder) return Response.json({ error: 'Folder not found' }, { status: 404 });

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

    const files = await entities.SharedFile.filter({ folder_id: folder.id });
    for (const file of files) {
      await entities.SharedFile.update(file.id, { folder_id: null });
    }

    await entities.Folder.delete(folder.id);
    return Response.json({
      success: true,
      deleted: true,
      detached_files: files.length,
    });
  } catch (error) {
    console.error('deleteFolder error:', error);
    return Response.json({ error: error?.message || 'Folder deletion failed' }, { status: 500 });
  }
});
