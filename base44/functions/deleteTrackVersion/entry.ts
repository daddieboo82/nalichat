import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { isBase44EntityId } from '../../shared/workflowEvents.ts';
import { acquireTrackLifecycleLock, releaseTrackLifecycleLock } from '../../shared/trackLifecycleLock.ts';

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
      'track_version_delete',
      240,
    );
    if (!writeRate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const { versionId } = await readJsonBodyLimited(req, 64 * 1024);
    if (typeof versionId !== 'string' || !isBase44EntityId(versionId.trim())) {
      return Response.json({ error: 'versionId is required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const version = await entities.TrackVersion.get(versionId);
    if (!version) return Response.json({ error: 'Track version not found' }, { status: 404 });
    if (!isBase44EntityId(version.project_id) || !isBase44EntityId(version.track_id)) {
      return Response.json({ error: 'Track version has invalid project or track references' }, { status: 409 });
    }

    const projectPreview = await entities.Project.get(version.project_id).catch(() => null);
    if (!projectPreview) return Response.json({ error: 'Project not found' }, { status: 404 });
    const previewCanEdit = user.role === 'admin'
      || projectPreview.owner_id === user.id
      || (projectPreview.editor_ids || []).includes(user.id);
    if (!previewCanEdit) {
      return Response.json({ error: 'Viewer access cannot delete track versions' }, { status: 403 });
    }

    const lockId = await acquireTrackLifecycleLock(entities, version.track_id);
    if (!lockId) {
      return Response.json({ error: 'Track is being updated. Please retry.' }, { status: 409 });
    }

    try {
      const currentVersion = await entities.TrackVersion.get(version.id).catch(() => null);
      if (!currentVersion) {
        return Response.json({ error: 'Track version not found' }, { status: 404 });
      }
      if (
        !isBase44EntityId(currentVersion.project_id)
        || !isBase44EntityId(currentVersion.track_id)
        || currentVersion.project_id !== version.project_id
        || currentVersion.track_id !== version.track_id
      ) {
        return Response.json({ error: 'Track version references changed. Please retry.' }, { status: 409 });
      }

      const project = await entities.Project.get(currentVersion.project_id).catch(() => null);
      if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

      const canEdit = user.role === 'admin'
        || project.owner_id === user.id
        || (project.editor_ids || []).includes(user.id);
      if (!canEdit) {
        return Response.json({ error: 'Viewer access cannot delete track versions' }, { status: 403 });
      }

      await entities.TrackVersion.delete(currentVersion.id);
      return Response.json({ success: true, deleted: true });
    } finally {
      await releaseTrackLifecycleLock(entities, lockId);
    }
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('deleteTrackVersion error:', error);
    return Response.json({ error: 'Track version deletion failed' }, { status: 500 });
  }
});
