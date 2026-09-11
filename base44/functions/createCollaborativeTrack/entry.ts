import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const projectId = String(body?.project_id || '');
    if (!projectId || !body?.name) {
      return Response.json({ error: 'project_id and name are required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    let accessUserIds = [user.id];
    let editUserIds = [user.id];

    try {
      const project = await entities.Project.get(projectId);
      if (project) {
        const canEdit = project.owner_id === user.id || (project.editor_ids || []).includes(user.id);
        if (!canEdit) return Response.json({ error: 'Viewer access cannot create tracks' }, { status: 403 });
        accessUserIds = Array.from(new Set([
          project.owner_id,
          ...(project.collaborator_ids || []),
          user.id,
        ].filter(Boolean)));
        editUserIds = Array.from(new Set([
          project.owner_id,
          ...(project.editor_ids || []),
          user.id,
        ].filter(Boolean)));
      }
    } catch {
      // Chat-session tracks use the parent Message ID as project_id.
      try {
        const message = await entities.Message.get(projectId);
        if (!message?.participant_ids?.includes(user.id)) {
          return Response.json({ error: 'Forbidden' }, { status: 403 });
        }
        accessUserIds = message.participant_ids;
        editUserIds = message.participant_ids;
      } catch {
        return Response.json({ error: 'Project/session not found' }, { status: 404 });
      }
    }

    const allowedTypes = new Set(['vocal', 'instrument', 'beat', 'sample', 'fx', 'master']);
    const track = await entities.Track.create({
      project_id: projectId,
      name: String(body.name).slice(0, 200),
      file_url: typeof body.file_url === 'string' ? body.file_url : '',
      type: allowedTypes.has(body.type) ? body.type : 'vocal',
      color: typeof body.color === 'string' ? body.color : undefined,
      volume: Number.isFinite(Number(body.volume)) ? Number(body.volume) : 75,
      pan: Number.isFinite(Number(body.pan)) ? Number(body.pan) : 0,
      muted: Boolean(body.muted),
      solo: Boolean(body.solo),
      duration: Number.isFinite(Number(body.duration)) ? Number(body.duration) : undefined,
      waveform_data: Array.isArray(body.waveform_data) ? body.waveform_data.slice(0, 2000) : undefined,
      uploaded_by: user.id,
      access_user_ids: accessUserIds,
      edit_user_ids: editUserIds,
    });

    return Response.json({ success: true, track });
  } catch (error) {
    return Response.json({ error: error?.message || 'Could not create track' }, { status: 500 });
  }
});
