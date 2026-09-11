import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

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
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const projectId = String(body?.projectId || '');
    const data = body?.data && typeof body.data === 'object' ? body.data : {};
    if (!projectId) return Response.json({ error: 'projectId is required' }, { status: 400 });

    const entities = base44.asServiceRole.entities;
    const project = await entities.Project.get(projectId);
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

    const canEdit = user.role === 'admin'
      || project.owner_id === user.id
      || (project.editor_ids || []).includes(user.id);
    if (!canEdit) return Response.json({ error: 'Viewer access cannot modify this project' }, { status: 403 });

    const patch: Record<string, unknown> = {};

    if (data.title !== undefined) {
      const title = String(data.title || '').trim().slice(0, 200);
      if (!title) return Response.json({ error: 'Project title cannot be empty' }, { status: 400 });
      patch.title = title;
    }
    if (data.description !== undefined) patch.description = String(data.description || '').slice(0, 3000);
    if (data.genre !== undefined) patch.genre = String(data.genre || '').trim().slice(0, 100);
    if (data.key !== undefined) patch.key = String(data.key || '').trim().slice(0, 50);

    if (data.bpm !== undefined) {
      const bpm = Number(data.bpm);
      if (!Number.isFinite(bpm) || bpm < 1 || bpm > 400) {
        return Response.json({ error: 'Project BPM must be between 1 and 400' }, { status: 400 });
      }
      patch.bpm = bpm;
    }

    if (data.status !== undefined) {
      const status = String(data.status || '');
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
  } catch (error) {
    console.error('mutateProject error:', error);
    return Response.json({ error: error?.message || 'Project update failed' }, { status: 500 });
  }
});
