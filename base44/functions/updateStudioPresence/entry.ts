import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

async function presenceId(roomId: string, userId: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${roomId}:${userId}`),
  );
  const suffix = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `studio_presence_${suffix}`;
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

    const writeRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'studio_presence',
      1500,
    );
    if (!writeRate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const body = await readJsonBodyLimited(req, 16 * 1024);
    const roomId = typeof body?.roomId === 'string' ? body.roomId.trim() : '';
    const action = body?.action == null
      ? 'heartbeat'
      : (typeof body.action === 'string' ? body.action : '');
    if (!roomId || roomId.length > 200 || !['heartbeat', 'clear'].includes(action)) {
      return Response.json({ error: 'Valid roomId and action are required' }, { status: 400 });
    }
    if (body?.activity != null && typeof body.activity !== 'string') {
      return Response.json({ error: 'activity must be a string' }, { status: 400 });
    }
    if (typeof body?.activity === 'string' && body.activity.length > 200) {
      return Response.json({ error: 'activity must be 200 characters or fewer' }, { status: 413 });
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

    const deterministicId = await presenceId(roomId, user.id);
    const legacyRows = await entities.StudioPresence.filter({
      room_id: roomId,
      user_id: user.id,
    }, '-created_date', 20);

    if (action === 'clear') {
      const ids = new Set([deterministicId, ...legacyRows.map((row: any) => row.id)]);
      let cleared = 0;
      let cleanupFailures = 0;
      for (const id of ids) {
        try {
          await entities.StudioPresence.delete(id);
          cleared += 1;
        } catch (cleanupError) {
          cleanupFailures += 1;
          console.error('Failed to clear Studio presence row', {
            userId: user.id,
            roomId,
            presenceId: id,
            cleanupError: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
          });
        }
      }
      return Response.json({ success: true, cleared, cleanup_failures: cleanupFailures });
    }

    const payload = {
      room_id: roomId,
      user_id: user.id,
      user_name: user.display_name || user.full_name || 'Artist',
      user_avatar: user.avatar_url || '',
      activity: typeof body?.activity === 'string' && body.activity.trim()
        ? body.activity.trim()
        : 'In the studio',
      last_heartbeat: new Date().toISOString(),
      access_user_ids: accessUserIds,
    };

    let updated = await entities.StudioPresence.get(deterministicId).catch(() => null);
    if (updated) {
      updated = await entities.StudioPresence.update(deterministicId, payload);
    } else {
      try {
        updated = await entities.StudioPresence.create({ id: deterministicId, ...payload });
      } catch (createError) {
        const raced = await entities.StudioPresence.get(deterministicId).catch(() => null);
        if (!raced) throw createError;
        updated = await entities.StudioPresence.update(deterministicId, payload);
      }
    }

    let cleanupFailures = 0;
    for (const duplicate of legacyRows) {
      if (duplicate.id === deterministicId) continue;
      try {
        await entities.StudioPresence.delete(duplicate.id);
      } catch (cleanupError) {
        cleanupFailures += 1;
        console.error('Failed to remove duplicate Studio presence row', {
          userId: user.id,
          roomId,
          presenceId: duplicate.id,
          cleanupError: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        });
      }
    }

    return Response.json({ success: true, presence: updated, cleanup_failures: cleanupFailures });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('updateStudioPresence error:', error);
    return Response.json({ error: error?.message || 'Studio presence update failed' }, { status: 500 });
  }
});
