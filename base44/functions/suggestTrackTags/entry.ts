import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { requireEntitlement, preferredAiModel } from '../../shared/entitlementAccess.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { acquireTrackLifecycleLock, releaseTrackLifecycleLock } from '../../shared/trackLifecycleLock.ts';
import { isBase44EntityId } from '../../shared/workflowEvents.ts';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { validWorkflowKey } from '../../shared/workflowAuth.ts';
import {
  AiQuotaError,
  aiQuotaErrorResponse,
  executeMeteredAiRequest,
} from '../../shared/aiQuota.ts';

const WORKFLOW_KEY_SHA256 = '8a23393629bd84561def878655762b9b084180d9489006d197512e223d8bd700';

// Triggered by an entity automation when a Track is created.
// Analyzes the uploaded track and suggests a genre + BPM, then saves them
// back onto the Track. If the parent Project has no genre/bpm yet, fills those too.
Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }
    const base44 = createClientFromRequest(req);
    const body = await readJsonBodyLimited(req, 64 * 1024);
    const caller = await base44.auth.me().catch(() => null);

    const eventTrackId = typeof body?.event?.entity_id === 'string' ? body.event.entity_id.trim() : '';
    const directTrackId = typeof body?.trackId === 'string'
      ? body.trackId.trim()
      : (typeof body?.track_id === 'string' ? body.track_id.trim() : '');
    const trackId = eventTrackId || directTrackId;

    if (!isBase44EntityId(trackId)) {
      return Response.json({ error: 'Valid trackId is required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    // Resolve and authorize the caller before acquiring the lifecycle lock so
    // invalid direct/workflow requests cannot create lock contention.
    const trackPreview = await entities.Track.get(trackId).catch(() => null);
    if (!trackPreview) {
      return Response.json({ error: 'Track not found' }, { status: 404 });
    }

    const authorizeTrackRequest = async (track: any) => {
      if (caller) {
        if (caller.is_banned) {
          return Response.json({ error: 'Forbidden: banned account' }, { status: 403 });
        }
        if (caller.timeout_until && Date.parse(caller.timeout_until) > Date.now()) {
          return Response.json({ error: 'Forbidden: timed out account' }, { status: 403 });
        }
        const canEdit = caller.role === 'admin'
          || track.uploaded_by === caller.id
          || (track.edit_user_ids || []).includes(caller.id);
        if (!canEdit) {
          return Response.json({ error: 'Forbidden: track edit access required' }, { status: 403 });
        }
        return null;
      }

      if (!(await validWorkflowKey(body?.workflow_key, WORKFLOW_KEY_SHA256))) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const isCreateAutomation = body?.event?.type === 'create' && eventTrackId === track.id;
      const createdAt = Date.parse(track.created_date || '');
      const isFresh = Number.isFinite(createdAt) && Date.now() - createdAt <= 10 * 60 * 1000;
      if (!isCreateAutomation || !isFresh) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return null;
    };

    const previewAuthError = await authorizeTrackRequest(trackPreview);
    if (previewAuthError) return previewAuthError;

    // Use the authorized preview for entitlement, rate, project context, and AI work.
    // These steps may involve network/provider latency, so keep them outside the
    // track lifecycle lock. The lock is acquired only for the final freshness
    // check and metadata writes.
    if (trackPreview.suggested_genre && trackPreview.suggested_bpm) {
      return Response.json({ success: true, skipped: true, reason: 'already_suggested' });
    }

    const uploaderId = trackPreview.uploaded_by;
    if (!uploaderId) {
      return Response.json({ success: true, skipped: true, reason: 'missing_uploader' });
    }
    if (!isBase44EntityId(uploaderId)) {
      return Response.json({ success: true, skipped: true, reason: 'invalid_uploader_reference' });
    }
    const uploader = await entities.User.get(uploaderId).catch(() => null);
    if (!uploader) {
      return Response.json({ success: true, skipped: true, reason: 'missing_uploader_user' });
    }
    if (uploader.is_banned) {
      return Response.json({ success: true, skipped: true, reason: 'uploader_banned' });
    }
    if (uploader.timeout_until && new Date(uploader.timeout_until).getTime() > Date.now()) {
      return Response.json({ success: true, skipped: true, reason: 'uploader_timed_out' });
    }

    const entitlementUserId = caller?.id || uploaderId;
    const { allowed, entitlements } = await requireEntitlement(
      base44.asServiceRole.entities,
      entitlementUserId,
      'ai.standard',
    );
    if (!allowed) {
      return Response.json({ success: true, skipped: true, reason: 'ai_not_entitled' });
    }

    const rate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      entitlementUserId,
      'ai_track_tag_suggestion',
      20,
    );
    if (!rate.allowed) {
      return Response.json({ success: true, skipped: true, reason: 'rate_limited' });
    }

    const previewProjectId = trackPreview.project_id || null;
    if (previewProjectId && !isBase44EntityId(previewProjectId)) {
      return Response.json({ error: 'Track has an invalid project reference' }, { status: 409 });
    }

    let projectPreview = null;
    if (previewProjectId) {
      projectPreview = await entities.Project.get(previewProjectId).catch(() => null);
    }

    const prompt = `You are a professional music producer analyzing an audio track to suggest metadata.

Track name: "${trackPreview.name}"
Track type: ${trackPreview.type || 'unknown'}
${trackPreview.duration ? `Duration: ${Math.round(trackPreview.duration)} seconds` : ''}
${projectPreview ? `Project title: "${projectPreview.title}"` : ''}
${projectPreview?.genre ? `Project genre: ${projectPreview.genre}` : ''}

Based on this, suggest the most likely musical genre and a typical BPM (beats per minute).
Return realistic values. BPM must be a whole number between 60 and 200.`;

    const quotaUser = { id: entitlementUserId };
    const { result, quota } = await executeMeteredAiRequest({
      base44,
      user: quotaUser,
      operation: 'track_tag_suggestion',
      requestKey: body?.request_key || `track-tags:${trackId}`,
      dispatch: () => base44.asServiceRole.integrations.Core.InvokeLLM({
        ...(preferredAiModel(entitlements) ? { model: preferredAiModel(entitlements) } : {}),
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            genre: { type: 'string' },
            bpm: { type: 'number' },
          },
          required: ['genre', 'bpm'],
        },
      }),
    });

    const suggestedGenre = String(result?.genre || '').trim().slice(0, 100);
    const suggestedBpm = Math.round(Number(result?.bpm));

    if (
      !suggestedGenre
      || !Number.isFinite(suggestedBpm)
      || suggestedBpm < 60
      || suggestedBpm > 200
    ) {
      console.error('LLM returned invalid suggestion', result);
      return Response.json({ error: 'Invalid suggestion from LLM' }, { status: 502 });
    }

    const lockId = await acquireTrackLifecycleLock(entities, trackId);
    if (!lockId) {
      return Response.json(
        { error: 'Track metadata is being updated. Please retry.' },
        { status: 409 },
      );
    }

    try {
      const track = await entities.Track.get(trackId);
      if (!track) {
        return Response.json({ error: 'Track not found' }, { status: 404 });
      }
      const lockedAuthError = await authorizeTrackRequest(track);
      if (lockedAuthError) return lockedAuthError;
      if (
        (track.project_id || null) !== previewProjectId
        || (track.project_id && !isBase44EntityId(track.project_id))
      ) {
        return Response.json({ error: 'Track project changed. Please retry.' }, { status: 409 });
      }

      if (track.suggested_genre && track.suggested_bpm) {
        return Response.json({
          success: true,
          skipped: true,
          reason: 'already_suggested',
          quota,
        });
      }

      await entities.Track.update(trackId, {
        suggested_genre: suggestedGenre,
        suggested_bpm: suggestedBpm,
      });

      if (previewProjectId) {
        const project = await entities.Project.get(previewProjectId).catch(() => null);
        if (project) {
          const projectUpdate: Record<string, unknown> = {};
          if (!project.genre) projectUpdate.genre = suggestedGenre;
          if (!project.bpm) projectUpdate.bpm = suggestedBpm;
          if (Object.keys(projectUpdate).length > 0) {
            await entities.Project.update(project.id, projectUpdate);
          }
        }
      }

      return Response.json({ success: true, suggestedGenre, suggestedBpm, quota });
    } finally {
      await releaseTrackLifecycleLock(entities, lockId);
    }
  } catch (error) {
    if (error instanceof AiQuotaError) return aiQuotaErrorResponse(error);
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('suggestTrackTags error:', error);
    return Response.json({ error: 'Track tag suggestion failed' }, { status: 500 });
  }
});