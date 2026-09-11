import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_banned) {
      return Response.json({ error: 'banned' }, { status: 403 });
    }

    const { name, project_id } = await req.json();
    const folderName = String(name || '').trim().slice(0, 200);
    if (!folderName) return Response.json({ error: 'name is required' }, { status: 400 });

    const entities = base44.asServiceRole.entities;
    let accessUserIds = [user.id];
    let editUserIds = [user.id];

    if (project_id) {
      const project = await entities.Project.get(project_id);
      if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });
      const canEdit = project.owner_id === user.id || (project.editor_ids || []).includes(user.id);
      if (!canEdit) return Response.json({ error: 'Viewer access cannot create folders' }, { status: 403 });
      accessUserIds = Array.from(new Set([project.owner_id, ...(project.collaborator_ids || [])]));
      editUserIds = Array.from(new Set([project.owner_id, ...(project.editor_ids || [])]));
    }

    const folder = await entities.Folder.create({
      name: folderName,
      owner_id: user.id,
      project_id: project_id || null,
      access_user_ids: accessUserIds,
      edit_user_ids: editUserIds,
    });
    return Response.json({ success: true, folder });
  } catch (error) {
    return Response.json({ error: error?.message || 'Could not create folder' }, { status: 500 });
  }
});
