import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

Deno.serve(async (req) => {
  try {
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
