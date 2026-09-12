import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { acquireProjectMembershipLock, releaseProjectMembershipLock } from '../../shared/projectMembershipLock.ts';
import { isBase44EntityId } from '../../shared/workflowEvents.ts';

const PROJECT_STATUSES = new Set(['draft','in_progress','mixing','mastering','complete']);

function jsonSize(value: unknown) {
  try {
    return new TextEncoder().encode(JSON.stringify(value ?? {})).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_banned) return Response.json({ error: 'banned' }, { status: 403 });
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const projectRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'project_mutation',
      300,
    );
    if (!projectRate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const body = await readJsonBodyLimited(req, 64 * 1024);
    const projectId = typeof body?.projectId === 'string' ? body.projectId.trim() : '';
    if (!isBase44EntityId(projectId)) {
      return Response.json({ error: 'projectId is required' }, { status: 400 });
    }
    if (!body?.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
      return Response.json({ error: 'data must be an object' }, { status: 400 });
    }
    const data = body.data;

    const entities = base44.asServiceRole.entities;
    const projectPreview = await entities.Project.get(projectId).catch(() => null);
    if (!projectPreview) return Response.json({ error: 'Project not found' }, { status: 404 });
    const previewCanEdit = user.role === 'admin'
      || projectPreview.owner_id === user.id
      || (projectPreview.editor_ids || []).includes(user.id);
    if (!previewCanEdit) {
      return Response.json({ error: 'Viewer access cannot modify this project' }, { status: 403 });
    }

    const lockId = await acquireProjectMembershipLock(entities, projectId);
    if (!lockId) {
      return Response.json(
        { error: 'Project is being updated. Please retry.' },
        { status: 409 },
      );
    }

    try {
    const project = await entities.Project.get(projectId);
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

    const canEdit = user.role === 'admin'
      || project.owner_id === user.id
      || (project.editor_ids || []).includes(user.id);
    if (!canEdit) return Response.json({ error: 'Viewer access cannot modify this project' }, { status: 403 });

    const patch: Record<string, unknown> = {};

    if (data.title !== undefined) {
      if (typeof data.title !== 'string') {
        return Response.json({ error: 'Project title must be a string' }, { status: 400 });
      }
      const title = data.title.trim();
      if (!title) return Response.json({ error: 'Project title cannot be empty' }, { status: 400 });
      if (title.length > 200) {
        return Response.json({ error: 'Project title must be 200 characters or fewer' }, { status: 413 });
      }
      patch.title = title;
    }
    if (data.description !== undefined) {
      if (typeof data.description !== 'string') {
        return Response.json({ error: 'Project description must be a string' }, { status: 400 });
      }
      if (data.description.length > 3000) {
        return Response.json({ error: 'Project description must be 3000 characters or fewer' }, { status: 413 });
      }
      patch.description = data.description;
    }
    if (data.genre !== undefined) {
      if (typeof data.genre !== 'string') {
        return Response.json({ error: 'Project genre must be a string' }, { status: 400 });
      }
      const genre = data.genre.trim();
      if (genre.length > 100) {
        return Response.json({ error: 'Project genre must be 100 characters or fewer' }, { status: 413 });
      }
      patch.genre = genre;
    }
    if (data.key !== undefined) {
      if (typeof data.key !== 'string') {
        return Response.json({ error: 'Project key must be a string' }, { status: 400 });
      }
      const key = data.key.trim();
      if (key.length > 50) {
        return Response.json({ error: 'Project key must be 50 characters or fewer' }, { status: 413 });
      }
      patch.key = key;
    }

    if (data.bpm !== undefined) {
      const bpm = Number(data.bpm);
      if (!Number.isFinite(bpm) || bpm < 1 || bpm > 400) {
        return Response.json({ error: 'Project BPM must be between 1 and 400' }, { status: 400 });
      }
      patch.bpm = bpm;
    }

    if (data.status !== undefined) {
      if (typeof data.status !== 'string') {
        return Response.json({ error: 'Project status must be a string' }, { status: 400 });
      }
      const status = data.status;
      if (!PROJECT_STATUSES.has(status)) {
        return Response.json({ error: 'Invalid project status' }, { status: 400 });
      }
      patch.status = status;
    }

    if (data.master_fx !== undefined) {
      if (!data.master_fx || typeof data.master_fx !== 'object' || Array.isArray(data.master_fx)) {
        return Response.json({ error: 'master_fx must be an object' }, { status: 400 });
      }
      if (jsonSize(data.master_fx) > 256 * 1024) {
        return Response.json({ error: 'Master FX state is too large' }, { status: 413 });
      }
      patch.master_fx = data.master_fx;
    }

    if (data.studio_state !== undefined) {
      if (!data.studio_state || typeof data.studio_state !== 'object' || Array.isArray(data.studio_state)) {
        return Response.json({ error: 'studio_state must be an object' }, { status: 400 });
      }
      if (jsonSize(data.studio_state) > 5 * 1024 * 1024) {
        return Response.json({ error: 'Studio state is too large' }, { status: 413 });
      }
      patch.studio_state = data.studio_state;
    }

    if (Object.keys(patch).length === 0) {
      return Response.json({ error: 'No supported project fields supplied' }, { status: 400 });
    }

    const updated = await entities.Project.update(project.id, patch);
    return Response.json({ success: true, project: updated });
    } finally {
      await releaseProjectMembershipLock(entities, lockId);
    }
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('mutateProject error:', error);
    return Response.json({ error: 'Project update failed' }, { status: 500 });
  }
});
