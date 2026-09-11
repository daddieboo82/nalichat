import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { acquireProjectMembershipLock, releaseProjectMembershipLock } from '../../shared/projectMembershipLock.ts';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    if (user.is_banned) {
      return Response.json({ error: 'banned' }, { status: 403 });
    }

    const { name, project_id } = await req.json();
    if (typeof name !== 'string') {
      return Response.json({ error: 'name is required' }, { status: 400 });
    }
    if (project_id != null && typeof project_id !== 'string') {
      return Response.json({ error: 'project_id must be a string or null' }, { status: 400 });
    }

    const folderName = name.trim();
    const projectId = typeof project_id === 'string' ? project_id.trim() : '';
    if (!folderName) return Response.json({ error: 'name is required' }, { status: 400 });
    if (folderName.length > 200) {
      return Response.json({ error: 'Folder name must be 200 characters or fewer' }, { status: 413 });
    }
    if (projectId.length > 200) {
      return Response.json({ error: 'project_id is too long' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const rate = await consumeHourlyLimit(entities, user.id, 'project_folder_create', 120);
    if (!rate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }
    let accessUserIds = [user.id];
    let editUserIds = [user.id];

    let lockId: string | null = null;
    if (projectId) {
      lockId = await acquireProjectMembershipLock(entities, projectId);
      if (!lockId) {
        return Response.json(
          { error: 'Project is being updated. Please retry.' },
          { status: 409 },
        );
      }
    }

    try {
      if (projectId) {
        const project = await entities.Project.get(projectId);
        if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });
        const canEdit = project.owner_id === user.id || (project.editor_ids || []).includes(user.id);
        if (!canEdit) return Response.json({ error: 'Viewer access cannot create folders' }, { status: 403 });
        accessUserIds = Array.from(new Set([project.owner_id, ...(project.collaborator_ids || [])]));
        editUserIds = Array.from(new Set([project.owner_id, ...(project.editor_ids || [])]));
      }

      const folder = await entities.Folder.create({
        name: folderName,
        owner_id: user.id,
        project_id: projectId || null,
        access_user_ids: accessUserIds,
        edit_user_ids: editUserIds,
      });
      return Response.json({ success: true, folder });
    } finally {
      await releaseProjectMembershipLock(entities, lockId);
    }
  } catch (error) {
    return Response.json({ error: error?.message || 'Could not create folder' }, { status: 500 });
  }
});
