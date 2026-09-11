import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const projectId = String(body?.projectId || '');
    const role = body?.role == null ? null : String(body.role);
    if (!projectId) {
      return Response.json({ error: 'projectId is required' }, { status: 400 });
    }
    if (role && !['editor', 'viewer'].includes(role)) {
      return Response.json({ error: 'Invalid role' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const project = await entities.Project.get(projectId);
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });
    if (project.owner_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the project owner can revoke invite links' }, { status: 403 });
    }

    const filters: Record<string, unknown> = { project_id: project.id };
    if (role) filters.role = role;
    const invites = await entities.ProjectInvite.filter(filters);

    for (const invite of invites) {
      await entities.ProjectInvite.delete(invite.id);
    }

    return Response.json({
      success: true,
      revoked: invites.length,
      role,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('revokeProjectInvites error:', error);
    return Response.json({ error: error?.message || 'Could not revoke invite links' }, { status: 500 });
  }
});
