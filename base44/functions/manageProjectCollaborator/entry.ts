import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { isBase44EntityId } from '../../shared/workflowEvents.ts';
import { acquireProjectMembershipLock, releaseProjectMembershipLock } from '../../shared/projectMembershipLock.ts';

async function rollbackChildChanges(
  changes: Array<{ entity: any; id: string; original: Record<string, any> }>,
) {
  const failures: Array<{ id: string; error: unknown }> = [];
  for (const change of [...changes].reverse()) {
    try {
      await change.entity.update(change.id, change.original);
    } catch (error) {
      failures.push({ id: change.id, error });
    }
  }
  if (failures.length > 0) {
    console.error('Project collaborator child rollback failures:', failures);
    throw new Error(`Could not restore ${failures.length} project record(s)`);
  }
}

const CHILD_SYNC_BATCH_SIZE = 200;

async function syncChildren(entities: any, project: any, userId: string, role: string | null) {
  const changed: Array<{ entity: any; id: string; original: Record<string, any> }> = [];
  try {
    for (const entityName of ['Track', 'TrackVersion', 'SharedFile', 'Folder', 'Milestone']) {
      const entity = entities[entityName];
      if (!entity) continue;

      for (let skip = 0; ; skip += CHILD_SYNC_BATCH_SIZE) {
        const rows = await entity.filter(
          { project_id: project.id },
          '-created_date',
          CHILD_SYNC_BATCH_SIZE,
          skip,
        );
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

        if (rows.length < CHILD_SYNC_BATCH_SIZE) break;
      }
    }
  } catch (error) {
    try {
      await rollbackChildChanges(changed);
    } catch (rollbackError) {
      throw new Error(
        'Collaborator child update failed and rollback was incomplete. Please retry.',
        { cause: error },
      );
    }
    throw error;
  }

  return async () => {
    await rollbackChildChanges(changed);
  };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const owner = await base44.auth.me();
    if (!owner?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (owner.is_banned) return Response.json({ error: 'banned' }, { status: 403 });
    if (owner.timeout_until && new Date(owner.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: owner.timeout_until }, { status: 403 });
    }


    const { projectId, userId, action, role } = await readJsonBodyLimited(req, 64 * 1024);
    if (
      typeof projectId !== 'string'
      || typeof userId !== 'string'
      || !isBase44EntityId(projectId.trim())
      || !isBase44EntityId(userId.trim())
      || !['set_role', 'remove'].includes(action)
    ) {
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
    const projectPreview = await entities.Project.get(projectId).catch(() => null);
    if (!projectPreview) return Response.json({ error: 'Project not found' }, { status: 404 });
    if (projectPreview.owner_id !== owner.id) {
      return Response.json({ error: 'Only the project owner can manage collaborator roles' }, { status: 403 });
    }

    const lockId = await acquireProjectMembershipLock(entities, projectId);
    if (!lockId) {
      return Response.json(
        { error: 'Project membership is being updated. Please retry.' },
        { status: 409 },
      );
    }

    try {
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
        try {
          await entities.Project.update(project.id, originalProjectPatch);
        } catch (rollbackError) {
          console.error('Project collaborator privilege rollback failed:', rollbackError);
          throw new Error(
            'Collaborator role update failed and project rollback was incomplete. Please retry.',
            { cause: error },
          );
        }
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
        try {
          await rollbackChildren();
        } catch (rollbackError) {
          console.error('Project collaborator child rollback failed:', rollbackError);
          throw new Error(
            'Project update failed and collaborator child rollback was incomplete. Please retry.',
            { cause: error },
          );
        }
        throw error;
      }
    }

    return Response.json({
      success: true,
      action: 'manage_project_collaborator',
      userId: owner.id,
      projectId: project.id,
      collaboratorId: userId,
      collaboratorAction: action,
      role: action === 'remove' ? null : role,
    });
    } finally {
      await releaseProjectMembershipLock(entities, lockId);
    }
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    return Response.json({ error: 'Could not update collaborator' }, { status: 500 });
  }
});
