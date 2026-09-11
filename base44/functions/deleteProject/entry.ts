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
      'project_delete',
      30,
    );
    if (!writeRate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const { projectId, confirmation } = await req.json();
    if (!projectId || confirmation !== 'DELETE') {
      return Response.json({ error: 'projectId and DELETE confirmation are required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const project = await entities.Project.get(String(projectId));
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });
    if (project.owner_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the project owner can delete this project' }, { status: 403 });
    }

    const tracks = await entities.Track.filter({ project_id: project.id });
    for (const track of tracks) {
      const comments = await entities.TrackComment.filter({
        track_id: track.id,
        parent_type: 'track',
      });
      for (const comment of comments) await entities.TrackComment.delete(comment.id);
    }

    const deleted: Record<string, number> = {};
    for (const entityName of [
      'TrackVersion',
      'Track',
      'SharedFile',
      'Folder',
      'Milestone',
      'ProjectInvite',
    ]) {
      const entity = entities[entityName];
      if (!entity) continue;
      const rows = await entity.filter({ project_id: project.id });
      deleted[entityName] = rows.length;
      for (const row of rows) await entity.delete(row.id);
    }

    const presenceRows = await entities.StudioPresence.filter({ room_id: project.id });
    deleted.StudioPresence = presenceRows.length;
    for (const presence of presenceRows) await entities.StudioPresence.delete(presence.id);

    await entities.Project.delete(project.id);

    return Response.json({
      success: true,
      project_id: project.id,
      deleted,
    });
  } catch (error) {
    console.error('deleteProject error:', error);
    return Response.json({ error: error?.message || 'Project deletion failed' }, { status: 500 });
  }
});
