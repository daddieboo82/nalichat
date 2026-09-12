import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { acquireTrackLifecycleLock, releaseTrackLifecycleLock } from '../../shared/trackLifecycleLock.ts';

const MUTABLE_KEYS = new Set([
  'name','volume','pan','muted','solo','color','description','waveform_data','duration'
]);
const DELETE_BATCH_SIZE = 200;

async function deleteChildren(entity: any, query: Record<string, unknown>): Promise<number> {
  let deleted = 0;
  while (true) {
    const rows = await entity.filter(query, '-created_date', DELETE_BATCH_SIZE);
    if (rows.length === 0) return deleted;
    for (const row of rows) {
      await entity.delete(row.id);
      deleted += 1;
    }
    if (rows.length < DELETE_BATCH_SIZE) return deleted;
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

    const writeRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'track_mutation',
      600,
    );
    if (!writeRate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const body = await readJsonBodyLimited(req, 64 * 1024);
    const trackId = typeof body?.trackId === 'string' ? body.trackId.trim() : '';
    const action = typeof body?.action === 'string' ? body.action : '';
    if (!trackId || trackId.length > 200 || !['update', 'delete'].includes(action)) {
      return Response.json({ error: 'Valid trackId and action are required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const lockId = await acquireTrackLifecycleLock(entities, trackId);
    if (!lockId) {
      return Response.json({ error: 'Track is being updated. Please retry.' }, { status: 409 });
    }

    try {
    const track = await entities.Track.get(trackId);
    if (!track) return Response.json({ error: 'Track not found' }, { status: 404 });

    let canEdit = user.role === 'admin'
      || (Array.isArray(track.edit_user_ids) && track.edit_user_ids.includes(user.id));

    if (!canEdit) {
      const project = await entities.Project.get(track.project_id).catch(() => null);
      if (project) {
        canEdit = project.owner_id === user.id || (project.editor_ids || []).includes(user.id);
      } else {
        // Chat-session tracks use the parent Message ID as project_id.
        const sessionMessage = await entities.Message.get(track.project_id).catch(() => null);
        canEdit = Array.isArray(sessionMessage?.participant_ids)
          && sessionMessage.participant_ids.includes(user.id);
      }
    }
    if (!canEdit) return Response.json({ error: 'Viewer access cannot modify this track' }, { status: 403 });

    if (action === 'delete') {
      const [deletedVersions, deletedComments] = await Promise.all([
        deleteChildren(entities.TrackVersion, { track_id: track.id }),
        deleteChildren(entities.TrackComment, { track_id: track.id, parent_type: 'track' }),
      ]);
      await entities.Track.delete(track.id);
      return Response.json({
        success: true,
        deleted: true,
        deleted_versions: deletedVersions,
        deleted_comments: deletedComments,
      });
    }

    const input = body?.data || {};
    const patch: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      if (MUTABLE_KEYS.has(key)) patch[key] = value;
    }

    if (patch.name !== undefined) {
      if (typeof patch.name !== 'string') {
        return Response.json({ error: 'Track name must be a string' }, { status: 400 });
      }
      const name = patch.name.trim();
      if (!name) return Response.json({ error: 'Track name cannot be empty' }, { status: 400 });
      if (name.length > 200) {
        return Response.json({ error: 'Track name must be 200 characters or fewer' }, { status: 413 });
      }
      patch.name = name;
    }
    if (patch.description !== undefined) {
      if (typeof patch.description !== 'string') {
        return Response.json({ error: 'Track description must be a string' }, { status: 400 });
      }
      if (patch.description.length > 1000) {
        return Response.json({ error: 'Track description must be 1000 characters or fewer' }, { status: 413 });
      }
    }
    if (patch.color !== undefined) {
      if (typeof patch.color !== 'string') {
        return Response.json({ error: 'Track color must be a string' }, { status: 400 });
      }
      if (patch.color.length > 100) {
        return Response.json({ error: 'Track color must be 100 characters or fewer' }, { status: 413 });
      }
    }

    if (patch.volume !== undefined) {
      const volume = Number(patch.volume);
      if (!Number.isFinite(volume) || volume < 0 || volume > 100) {
        return Response.json({ error: 'Track volume must be between 0 and 100' }, { status: 400 });
      }
      patch.volume = volume;
    }
    if (patch.pan !== undefined) {
      const pan = Number(patch.pan);
      if (!Number.isFinite(pan) || pan < 0 || pan > 100) {
        return Response.json({ error: 'Track pan must be between 0 and 100' }, { status: 400 });
      }
      patch.pan = pan;
    }
    if (patch.duration !== undefined) {
      const duration = Number(patch.duration);
      if (!Number.isFinite(duration) || duration < 0 || duration > 24 * 60 * 60) {
        return Response.json({ error: 'Invalid track duration' }, { status: 400 });
      }
      patch.duration = duration;
    }
    if (patch.muted !== undefined) {
      if (typeof patch.muted !== 'boolean') {
        return Response.json({ error: 'muted must be a boolean' }, { status: 400 });
      }
    }
    if (patch.solo !== undefined) {
      if (typeof patch.solo !== 'boolean') {
        return Response.json({ error: 'solo must be a boolean' }, { status: 400 });
      }
    }
    if (patch.waveform_data !== undefined) {
      if (!Array.isArray(patch.waveform_data)) {
        return Response.json({ error: 'waveform_data must be an array' }, { status: 400 });
      }
      if (patch.waveform_data.length > 2000) {
        return Response.json({ error: 'waveform_data supports at most 2000 points' }, { status: 413 });
      }
      if (patch.waveform_data.some((point: unknown) => typeof point !== 'number' || !Number.isFinite(point) || point < -1 || point > 1)) {
        return Response.json({ error: 'waveform_data points must be numbers between -1 and 1' }, { status: 400 });
      }
    }

    if (Object.keys(patch).length === 0) {
      return Response.json({ error: 'No supported track fields supplied' }, { status: 400 });
    }

    const updated = await entities.Track.update(track.id, patch);
    return Response.json({ success: true, track: updated });
    } finally {
      await releaseTrackLifecycleLock(entities, lockId);
    }
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    return Response.json({ error: 'Track mutation failed' }, { status: 500 });
  }
});
