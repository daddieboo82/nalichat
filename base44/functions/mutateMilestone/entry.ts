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
      'milestone_mutation',
      300,
    );
    if (!writeRate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const body = await req.json();
    const milestoneId = String(body?.milestoneId || '');
    const action = body?.action;
    if (!milestoneId || !['toggle', 'delete'].includes(action)) {
      return Response.json({ error: 'Valid milestoneId and action are required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const milestone = await entities.Milestone.get(milestoneId);
    if (!milestone) return Response.json({ error: 'Milestone not found' }, { status: 404 });

    let canEdit = user.role === 'admin';
    if (!canEdit) {
      const project = await entities.Project.get(milestone.project_id).catch(() => null);
      if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });
      canEdit = project.owner_id === user.id || (project.editor_ids || []).includes(user.id);
    }
    if (!canEdit) return Response.json({ error: 'Viewer access cannot modify milestones' }, { status: 403 });

    if (action === 'delete') {
      await entities.Milestone.delete(milestone.id);
      return Response.json({ success: true, deleted: true });
    }

    const completed = !milestone.completed;
    const updated = await entities.Milestone.update(milestone.id, {
      completed,
      completed_at: completed ? new Date().toISOString() : null,
      completed_by_id: completed ? user.id : null,
    });
    return Response.json({ success: true, milestone: updated });
  } catch (error) {
    return Response.json({ error: error?.message || 'Milestone mutation failed' }, { status: 500 });
  }
});
