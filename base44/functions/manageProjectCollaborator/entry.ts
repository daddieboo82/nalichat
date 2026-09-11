import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

async function syncChildren(entities: any, project: any, userId: string, role: string | null) {
  const changed: Array<{ entity: any; id: string; original: Record<string, any> }> = [];
  try {
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

        const original: Record<string, any> = {
          access_user_ids: Array.isArray(row.access_user_ids) ? row.access_user_ids : [],
          edit_user_ids: Array.isArray(row.edit_user_ids) ? row.edit_user_ids : [],
        };
        const patch: Record<string, any> = {
          access_user_ids: Array.from(accessUserIds),
          edit_user_ids: Array.from(editUserIds),
        };
        if (entityName === 'SharedFile') {
          original.share_token_hash = row.share_token_hash || null;
          original.share_token_expires_at = row.share_token_expires_at || null;
          patch.share_token_hash = null;
          patch.share_token_expires_at = null;
        }
        await entity.update(row.id, patch);
        changed.push({ entity, id: row.id, original });
      }
    }
  } catch (error) {
    for (const change of changed.reverse()) {
      await change.entity.update(change.id, change.original).catch(() => {});
    }
    throw error;
  }

  return async () => {
    for (const change of changed.reverse()) {
      await change.entity.update(change.id, change.original).catch(() => {});
    }
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const owner = await base44.auth.me();
    if (!owner?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (owner.is_banned) return Response.json({ error: 'banned' }, { status: 403 });
    if (owner.timeout_until && new Date(owner.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: owner.timeout_until }, { status: 403 });
    }


    const { projectId, userId, action, role } = await req.json();
    if (!projectId || !userId || !['set_role', 'remove'].includes(action)) {
      return Response.json({ error: 'Invalid collaborator update' }, { status: 400 });
    }
    if (action === 'set_role' && !['editor', 'viewer'].includes(role)) {
      return Response.json({ error: 'Invalid role' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const rate = await consumeHourlyLimit(entities, owner.id, 'project_collaborator_mutate', 60);
    if (!rate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }
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

    // This endpoint manages existing collaborators only. New collaborators must
    // join through an invite/consent flow rather than being added by arbitrary ID.
    if (action === 'set_role' && !collaboratorIds.has(userId)) {
      return Response.json({ error: 'User is not an existing collaborator' }, { status: 409 });
    }

    const originalProjectPatch = {
      collaborator_ids: Array.from(collaboratorIds),
      collaborator_roles: { ...roles },
      editor_ids: Array.from(editorIds),
    };
    const privilegeIncrease = action === 'set_role' && role === 'editor' && !editorIds.has(userId);

    if (action === 'remove') {
      collaboratorIds.delete(userId);
      editorIds.delete(userId);
      delete roles[userId];
    } else {
      collaboratorIds.add(userId);
      roles[userId] = role;
      if (role === 'editor') editorIds.add(userId);
      else editorIds.delete(userId);
    }

    const projectPatch = {
      collaborator_ids: Array.from(collaboratorIds),
      collaborator_roles: roles,
      editor_ids: Array.from(editorIds),
    };

    if (privilegeIncrease) {
      await entities.Project.update(project.id, projectPatch);
      try {
        await syncChildren(entities, project, userId, role);
      } catch (error) {
        await entities.Project.update(project.id, originalProjectPatch).catch(() => {});
        throw error;
      }
    } else {
      const rollbackChildren = await syncChildren(
        entities,
        project,
        userId,
        action === 'remove' ? null : role,
      );
      try {
        await entities.Project.update(project.id, projectPatch);
      } catch (error) {
        await rollbackChildren();
        throw error;
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error?.message || 'Could not update collaborator' }, { status: 500 });
  }
});
