import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
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

    const body = await readJsonBodyLimited(req, 64 * 1024);
    if (
      typeof body?.project_id !== 'string'
      || typeof body?.title !== 'string'
      || !body.project_id.trim()
      || !body.title.trim()
      || body.project_id.length > 200
    ) {
      return Response.json({ error: 'project_id and title are required' }, { status: 400 });
    }
    if (body.title.length > 200) {
      return Response.json({ error: 'Milestone title must be 200 characters or fewer' }, { status: 413 });
    }
    if (body?.description != null && typeof body.description !== 'string') {
      return Response.json({ error: 'description must be a string' }, { status: 400 });
    }
    if (typeof body?.description === 'string' && body.description.length > 1000) {
      return Response.json({ error: 'Milestone description must be 1000 characters or fewer' }, { status: 413 });
    }
    if (body?.due_date != null && typeof body.due_date !== 'string') {
      return Response.json({ error: 'due_date must be a string or null' }, { status: 400 });
    }
    if (body?.priority != null && !['low','medium','high'].includes(body.priority)) {
      return Response.json({ error: 'Invalid milestone priority' }, { status: 400 });
    }

    const projectId = body.project_id.trim();
    const entities = base44.asServiceRole.entities;
    const rate = await consumeHourlyLimit(entities, user.id, 'project_milestone_create', 120);
    if (!rate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }
    const projectPreview = await entities.Project.get(projectId).catch(() => null);
    if (!projectPreview) return Response.json({ error: 'Project not found' }, { status: 404 });
    const previewCanEdit = projectPreview.owner_id === user.id
      || (projectPreview.editor_ids || []).includes(user.id);
    if (!previewCanEdit) {
      return Response.json({ error: 'Viewer access cannot create milestones' }, { status: 403 });
    }

    const lockId = await acquireProjectMembershipLock(entities, projectId);
    if (!lockId) {
      return Response.json({ error: 'Project is being updated. Please retry.' }, { status: 409 });
    }

    try {
    const project = await entities.Project.get(projectId);
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });
    const canEdit = project.owner_id === user.id || (project.editor_ids || []).includes(user.id);
    if (!canEdit) return Response.json({ error: 'Viewer access cannot create milestones' }, { status: 403 });

    const milestone = await entities.Milestone.create({
      project_id: project.id,
      title: body.title.trim(),
      description: typeof body.description === 'string' ? body.description : '',
      due_date: body.due_date || null,
      priority: body.priority || 'medium',
      created_by_id: user.id,
      access_user_ids: Array.from(new Set([project.owner_id, ...(project.collaborator_ids || [])])),
      edit_user_ids: Array.from(new Set([project.owner_id, ...(project.editor_ids || [])])),
    });
    return Response.json({ success: true, milestone });
    } finally {
      await releaseProjectMembershipLock(entities, lockId);
    }
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    return Response.json({ error: 'Could not create milestone' }, { status: 500 });
  }
});
