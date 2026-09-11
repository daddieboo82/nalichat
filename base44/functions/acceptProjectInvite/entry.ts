import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { projectId, token } = await req.json();
    if (!projectId || !token) {
      return Response.json({ error: 'projectId and token are required' }, { status: 400 });
    }

    const tokenHash = await sha256Hex(String(token));
    const invites = await base44.asServiceRole.entities.ProjectInvite.filter({
      project_id: projectId,
      token_hash: tokenHash,
    });
    const invite = invites[0];
    if (!invite || new Date(invite.expires_at).getTime() < Date.now()) {
      return Response.json({ error: 'Invite is invalid or expired' }, { status: 403 });
    }

    const project = await base44.asServiceRole.entities.Project.get(projectId);
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

    if (project.owner_id === user.id) {
      return Response.json({ success: true, role: 'owner', already_member: true });
    }
    if ((project.collaborator_ids || []).includes(user.id)) {
      return Response.json({
        success: true,
        role: project.collaborator_roles?.[user.id] || 'viewer',
        already_member: true,
      });
    }

    if (project.owner_id !== user.id) {
      const collaboratorIds = Array.from(new Set([...(project.collaborator_ids || []), user.id]));
      const roles = { ...(project.collaborator_roles || {}), [user.id]: invite.role };
      const editorIds = new Set(project.editor_ids || []);
      if (invite.role === 'editor') editorIds.add(user.id);
      else editorIds.delete(user.id);

      await base44.asServiceRole.entities.Project.update(project.id, {
        collaborator_ids: collaboratorIds,
        collaborator_roles: roles,
        editor_ids: Array.from(editorIds),
      });

      // Keep child-record access in sync for already-existing collaborative data.
      for (const entityName of ['Track', 'TrackVersion', 'SharedFile', 'Folder', 'Milestone']) {
        const entity = base44.asServiceRole.entities[entityName];
        if (!entity) continue;
        const rows = await entity.filter({ project_id: project.id });
        for (const row of rows) {
          const accessUserIds = Array.from(new Set([...(row.access_user_ids || []), user.id]));
          const patch: Record<string, any> = { access_user_ids: accessUserIds };
          if ('edit_user_ids' in row || entityName === 'Track' || entityName === 'TrackVersion' || entityName === 'Folder' || entityName === 'Milestone') {
            const editUserIds = new Set(row.edit_user_ids || []);
            if (invite.role === 'editor') editUserIds.add(user.id);
            else editUserIds.delete(user.id);
            patch.edit_user_ids = Array.from(editUserIds);
          }
          await entity.update(row.id, patch);
        }
      }
    }

    await base44.asServiceRole.entities.ProjectInvite.update(invite.id, {
      used_count: (invite.used_count || 0) + 1,
    });

    return Response.json({ success: true, role: invite.role });
  } catch (error) {
    return Response.json({ error: error?.message || 'Could not accept project invite' }, { status: 500 });
  }
});
