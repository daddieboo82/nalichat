import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

async function syncChildren(entities: any, project: any, userId: string, role: string | null) {
  for (const entityName of ['Track', 'TrackVersion', 'SharedFile', 'Folder', 'Milestone']) {
    const entity = entities[entityName];
    if (!entity) continue;
    const rows = await entity.filter({ project_id: project.id });
    for (const row of rows) {
      const accessUserIds = new Set(row.access_user_ids || []);
      const editUserIds = new Set(row.edit_user_ids || []);
      if (role) accessUserIds.add(userId);
      else accessUserIds.delete(userId);

      if (role === 'editor') editUserIds.add(userId);
      else editUserIds.delete(userId);

      const patch: Record<string, any> = { access_user_ids: Array.from(accessUserIds) };
      if (entityName !== 'SharedFile') patch.edit_user_ids = Array.from(editUserIds);
      await entity.update(row.id, patch);
    }
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const owner = await base44.auth.me();
    if (!owner?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { projectId, userId, action, role } = await req.json();
    if (!projectId || !userId || !['set_role', 'remove'].includes(action)) {
      return Response.json({ error: 'Invalid collaborator update' }, { status: 400 });
    }
    if (action === 'set_role' && !['editor', 'viewer'].includes(role)) {
      return Response.json({ error: 'Invalid role' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const project = await entities.Project.get(projectId);
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });
    if (project.owner_id !== owner.id) {
      return Response.json({ error: 'Only the project owner can manage collaborator roles' }, { status: 403 });
    }
    if (userId === owner.id) {
      return Response.json({ error: 'The project owner role cannot be changed' }, { status: 400 });
    }

    const collaboratorIds = new Set(project.collaborator_ids || []);
    const editorIds = new Set(project.editor_ids || []);
    const roles = { ...(project.collaborator_roles || {}) };

    if (action === 'remove') {
      collaboratorIds.delete(userId);
      editorIds.delete(userId);
      delete roles[userId];
      await syncChildren(entities, project, userId, null);
    } else {
      collaboratorIds.add(userId);
      roles[userId] = role;
      if (role === 'editor') editorIds.add(userId);
      else editorIds.delete(userId);
      await syncChildren(entities, project, userId, role);
    }

    await entities.Project.update(project.id, {
      collaborator_ids: Array.from(collaboratorIds),
      collaborator_roles: roles,
      editor_ids: Array.from(editorIds),
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error?.message || 'Could not update collaborator' }, { status: 500 });
  }
});
