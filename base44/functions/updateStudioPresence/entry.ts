import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const roomId = String(body?.roomId || '').trim();
    const action = String(body?.action || 'heartbeat');
    if (!roomId || !['heartbeat', 'clear'].includes(action)) {
      return Response.json({ error: 'Valid roomId and action are required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    let accessUserIds = [user.id];

    const project = await entities.Project.get(roomId).catch(() => null);
    if (project) {
      const collaborators = Array.isArray(project.collaborator_ids) ? project.collaborator_ids : [];
      const isMember = project.owner_id === user.id || collaborators.includes(user.id);
      if (!isMember && user.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      accessUserIds = Array.from(new Set([
        project.owner_id,
        ...collaborators,
      ].filter(Boolean)));
    } else if (roomId !== 'local_studio') {
      return Response.json({ error: 'Studio room not found' }, { status: 404 });
    }

    const existing = await entities.StudioPresence.filter({
      room_id: roomId,
      user_id: user.id,
    });

    if (action === 'clear') {
      for (const row of existing) await entities.StudioPresence.delete(row.id);
      return Response.json({ success: true, cleared: existing.length });
    }

    const payload = {
      room_id: roomId,
      user_id: user.id,
      user_name: user.display_name || user.full_name || 'Artist',
      user_avatar: user.avatar_url || '',
      activity: String(body?.activity || 'In the studio').slice(0, 200),
      last_heartbeat: new Date().toISOString(),
      access_user_ids: accessUserIds,
    };

    const row = existing[0] || null;
    const updated = row
      ? await entities.StudioPresence.update(row.id, payload)
      : await entities.StudioPresence.create(payload);

    for (const duplicate of existing.slice(1)) {
      await entities.StudioPresence.delete(duplicate.id);
    }

    return Response.json({ success: true, presence: updated });
  } catch (error) {
    console.error('updateStudioPresence error:', error);
    return Response.json({ error: error?.message || 'Studio presence update failed' }, { status: 500 });
  }
});
