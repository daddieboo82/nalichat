import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_banned) {
      return Response.json({ error: 'banned' }, { status: 403 });
    }

    const body = await req.json();
    if (!body?.project_id || !body?.title?.trim()) {
      return Response.json({ error: 'project_id and title are required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const project = await entities.Project.get(body.project_id);
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });
    const canEdit = project.owner_id === user.id || (project.editor_ids || []).includes(user.id);
    if (!canEdit) return Response.json({ error: 'Viewer access cannot create milestones' }, { status: 403 });

    const milestone = await entities.Milestone.create({
      project_id: project.id,
      title: String(body.title).slice(0, 200),
      description: String(body.description || '').slice(0, 1000),
      due_date: body.due_date || null,
      priority: ['low','medium','high'].includes(body.priority) ? body.priority : 'medium',
      created_by_id: user.id,
      access_user_ids: Array.from(new Set([project.owner_id, ...(project.collaborator_ids || [])])),
      edit_user_ids: Array.from(new Set([project.owner_id, ...(project.editor_ids || [])])),
    });
    return Response.json({ success: true, milestone });
  } catch (error) {
    return Response.json({ error: error?.message || 'Could not create milestone' }, { status: 500 });
  }
});
