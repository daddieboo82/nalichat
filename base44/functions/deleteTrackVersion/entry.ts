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
      'track_version_delete',
      240,
    );
    if (!writeRate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const { versionId } = await req.json();
    if (!versionId) {
      return Response.json({ error: 'versionId is required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const version = await entities.TrackVersion.get(String(versionId));
    if (!version) return Response.json({ error: 'Track version not found' }, { status: 404 });

    const project = await entities.Project.get(version.project_id).catch(() => null);
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

    const canEdit = user.role === 'admin'
      || project.owner_id === user.id
      || (project.editor_ids || []).includes(user.id);
    if (!canEdit) {
      return Response.json({ error: 'Viewer access cannot delete track versions' }, { status: 403 });
    }

    await entities.TrackVersion.delete(version.id);
    return Response.json({ success: true, deleted: true });
  } catch (error) {
    console.error('deleteTrackVersion error:', error);
    return Response.json({ error: error?.message || 'Track version deletion failed' }, { status: 500 });
  }
});
