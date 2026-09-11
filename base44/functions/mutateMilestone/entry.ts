import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const milestoneId = String(body?.milestoneId || '');
    const action = body?.action;
    if (!milestoneId || !['toggle', 'delete'].includes(action)) {
      return Response.json({ error: 'Valid milestoneId and action are required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const milestone = await entities.Milestone.get(milestoneId);
    if (!milestone) return Response.json({ error: 'Milestone not found' }, { status: 404 });

    const canEdit = user.role === 'admin' || (milestone.edit_user_ids || []).includes(user.id);
    if (!canEdit) return Response.json({ error: 'Viewer access cannot modify milestones' }, { status: 403 });

    if (action === 'delete') {
      await entities.Milestone.delete(milestone.id);
      return Response.json({ success: true, deleted: true });
    }

    const completed = !milestone.completed;
    const updated = await entities.Milestone.update(milestone.id, {
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    });
    return Response.json({ success: true, milestone: updated });
  } catch (error) {
    return Response.json({ error: error?.message || 'Milestone mutation failed' }, { status: 500 });
  }
});
