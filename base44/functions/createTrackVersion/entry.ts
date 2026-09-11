import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    if (!body?.track_id || !body?.project_id) {
      return Response.json({ error: 'track_id and project_id are required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const [project, track] = await Promise.all([
      entities.Project.get(body.project_id),
      entities.Track.get(body.track_id),
    ]);
    if (!project || !track || track.project_id !== project.id) {
      return Response.json({ error: 'Project/track not found' }, { status: 404 });
    }
    const canEdit = project.owner_id === user.id || (project.editor_ids || []).includes(user.id);
    if (!canEdit) return Response.json({ error: 'Viewer access cannot save versions' }, { status: 403 });

    const versions = await entities.TrackVersion.filter({ track_id: track.id }, '-version_number', 1);
    const nextNum = (versions[0]?.version_number || 0) + 1;

    const version = await entities.TrackVersion.create({
      track_id: track.id,
      project_id: project.id,
      version_number: nextNum,
      label: String(body.label || `Version ${nextNum}`).slice(0, 200),
      file_url: track.file_url || body.file_url || '',
      volume: Number.isFinite(Number(body.volume)) ? Number(body.volume) : track.volume,
      pan: Number.isFinite(Number(body.pan)) ? Number(body.pan) : track.pan,
      muted: body.muted ?? track.muted,
      solo: body.solo ?? track.solo,
      saved_by_id: user.id,
      saved_by_name: user.display_name || user.full_name || user.email || 'User',
      access_user_ids: Array.from(new Set([
        project.owner_id,
        ...(project.collaborator_ids || []),
      ].filter(Boolean))),
      edit_user_ids: Array.from(new Set([
        project.owner_id,
        ...(project.editor_ids || []),
      ].filter(Boolean))),
    });

    return Response.json({ success: true, version });
  } catch (error) {
    return Response.json({ error: error?.message || 'Could not save track version' }, { status: 500 });
  }
});
