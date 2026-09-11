import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const entities = base44.asServiceRole.entities;
    const tracks = await entities.Track.filter({});
    let updatedTracks = 0;
    let updatedVersions = 0;

    for (const track of tracks) {
      if (Array.isArray(track.access_user_ids) && track.access_user_ids.length > 0) continue;

      let accessUserIds = [track.uploaded_by].filter(Boolean);
      try {
        const project = await entities.Project.get(track.project_id);
        if (project) {
          accessUserIds = Array.from(new Set([
            project.owner_id,
            ...(project.collaborator_ids || []),
            track.uploaded_by,
          ].filter(Boolean)));
        }
      } catch {
        // Chat-session tracks and legacy orphaned tracks fall back to uploader-only.
      }

      await entities.Track.update(track.id, { access_user_ids: accessUserIds });
      updatedTracks += 1;

      const versions = await entities.TrackVersion.filter({ track_id: track.id });
      for (const version of versions) {
        if (Array.isArray(version.access_user_ids) && version.access_user_ids.length > 0) continue;
        await entities.TrackVersion.update(version.id, { access_user_ids: accessUserIds });
        updatedVersions += 1;
      }
    }

    return Response.json({ success: true, updatedTracks, updatedVersions });
  } catch (error) {
    console.error('backfillTrackAccess failed:', error);
    return Response.json({ error: error?.message || 'Backfill failed' }, { status: 500 });
  }
});
