import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { acquireProjectMembershipLock, releaseProjectMembershipLock } from '../../shared/projectMembershipLock.ts';
import { acquireTrackLifecycleLock, releaseTrackLifecycleLock } from '../../shared/trackLifecycleLock.ts';
import { isBase44EntityId } from '../../shared/workflowEvents.ts';

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

    const writeRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'project_delete',
      30,
    );
    if (!writeRate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const { projectId, confirmation } = await readJsonBodyLimited(req, 64 * 1024);
    if (
      typeof projectId !== 'string'
      || !isBase44EntityId(projectId.trim())
      || confirmation !== 'DELETE'
    ) {
      return Response.json({ error: 'projectId and DELETE confirmation are required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const projectPreview = await entities.Project.get(projectId).catch(() => null);
    if (!projectPreview) return Response.json({ error: 'Project not found' }, { status: 404 });
    if (projectPreview.owner_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the project owner can delete this project' }, { status: 403 });
    }

    const lockId = await acquireProjectMembershipLock(entities, projectId);
    if (!lockId) {
      return Response.json(
        { error: 'Project membership is being updated. Please retry.' },
        { status: 409 },
      );
    }

    try {
    const project = await entities.Project.get(projectId);
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });
    if (project.owner_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the project owner can delete this project' }, { status: 403 });
    }

    const deleted: Record<string, number> = {};

    let deletedTracks = 0;
    let deletedComments = 0;
    while (true) {
      const tracks = await entities.Track.filter(
        { project_id: project.id },
        '-created_date',
        100,
      );
      if (tracks.length === 0) break;

      for (const track of tracks) {
        const trackLockId = await acquireTrackLifecycleLock(entities, track.id);
        if (!trackLockId) {
          return Response.json(
            { error: 'A track in this project is being updated. Please retry.' },
            { status: 409 },
          );
        }

        try {
          const currentTrack = await entities.Track.get(track.id).catch(() => null);
          if (!currentTrack || currentTrack.project_id !== project.id) continue;

          while (true) {
            const comments = await entities.TrackComment.filter(
              {
                track_id: track.id,
                parent_type: 'track',
              },
              '-created_date',
              200,
            );
            if (comments.length === 0) break;
            for (const comment of comments) {
              await entities.TrackComment.delete(comment.id);
              deletedComments += 1;
            }
            if (comments.length < 200) break;
          }
          await entities.Track.delete(track.id);
          deletedTracks += 1;
        } finally {
          await releaseTrackLifecycleLock(entities, trackLockId);
        }
      }

      if (tracks.length < 100) break;
    }
    deleted.Track = deletedTracks;
    deleted.TrackComment = deletedComments;

    for (const entityName of [
      'TrackVersion',
      'SharedFile',
      'Folder',
      'Milestone',
      'ProjectInvite',
    ]) {
      const entity = entities[entityName];
      if (!entity) continue;
      let count = 0;
      while (true) {
        const rows = await entity.filter(
          { project_id: project.id },
          '-created_date',
          200,
        );
        if (rows.length === 0) break;
        for (const row of rows) {
          await entity.delete(row.id);
          count += 1;
        }
        if (rows.length < 200) break;
      }
      deleted[entityName] = count;
    }

    let deletedPresence = 0;
    while (true) {
      const presenceRows = await entities.StudioPresence.filter(
        { room_id: project.id },
        '-last_heartbeat',
        200,
      );
      if (presenceRows.length === 0) break;
      for (const presence of presenceRows) {
        await entities.StudioPresence.delete(presence.id);
        deletedPresence += 1;
      }
      if (presenceRows.length < 200) break;
    }
    deleted.StudioPresence = deletedPresence;

    await entities.Project.delete(project.id);

    return Response.json({
      success: true,
      project_id: project.id,
      deleted,
    });
    } finally {
      await releaseProjectMembershipLock(entities, lockId);
    }
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('deleteProject error:', error);
    return Response.json({ error: 'Project deletion failed' }, { status: 500 });
  }
});
