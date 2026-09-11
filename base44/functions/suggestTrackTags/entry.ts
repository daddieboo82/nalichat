import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { requireEntitlement, preferredAiModel } from '../../shared/entitlementAccess.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

// Triggered by an entity automation when a Track is created.
// Analyzes the uploaded track and suggests a genre + BPM, then saves them
// back onto the Track. If the parent Project has no genre/bpm yet, fills those too.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const trackId = body?.event?.entity_id;

    if (!trackId) {
      return Response.json({ error: 'No track id in payload' }, { status: 400 });
    }

    // Never trust automation payload record fields. Resolve the authoritative
    // Track before checking entitlements or performing service-role writes.
    const track = await base44.asServiceRole.entities.Track.get(trackId);
    if (!track) {
      return Response.json({ error: 'Track not found' }, { status: 404 });
    }

    // Entity-create automations can be retried. Keep AI work idempotent so a
    // replay or direct invocation cannot repeatedly consume model credits.
    if (track.suggested_genre && track.suggested_bpm) {
      return Response.json({ success: true, skipped: true, reason: 'already_suggested' });
    }

    const uploaderId = track.uploaded_by;
    if (!uploaderId) {
      return Response.json({ success: true, skipped: true, reason: 'missing_uploader' });
    }
    const { allowed, entitlements } = await requireEntitlement(
      base44.asServiceRole.entities,
      uploaderId,
      'ai.standard',
    );
    if (!allowed) {
      return Response.json({ success: true, skipped: true, reason: 'ai_not_entitled' });
    }

    const rate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      uploaderId,
      'ai_track_tag_suggestion',
      20,
    );
    if (!rate.allowed) {
      return Response.json({ success: true, skipped: true, reason: 'rate_limited' });
    }

    // Pull project context for a better suggestion
    let project = null;
    if (track.project_id) {
      try {
        project = await base44.asServiceRole.entities.Project.get(track.project_id);
      } catch (_e) {
        project = null;
      }
    }

    const prompt = `You are a professional music producer analyzing an audio track to suggest metadata.

Track name: "${track.name}"
Track type: ${track.type || 'unknown'}
${track.duration ? `Duration: ${Math.round(track.duration)} seconds` : ''}
${project ? `Project title: "${project.title}"` : ''}
${project?.genre ? `Project genre: ${project.genre}` : ''}

Based on this, suggest the most likely musical genre and a typical BPM (beats per minute).
Return realistic values. BPM must be a whole number between 60 and 200.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
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

    await base44.asServiceRole.entities.Track.update(trackId, {
      suggested_genre: suggestedGenre,
      suggested_bpm: suggestedBpm,
    });

    // Fill in project genre/bpm only if currently empty (non-destructive)
    if (project) {
      const projectUpdate = {};
      if (!project.genre) projectUpdate.genre = suggestedGenre;
      if (!project.bpm) projectUpdate.bpm = suggestedBpm;
      if (Object.keys(projectUpdate).length > 0) {
        await base44.asServiceRole.entities.Project.update(project.id, projectUpdate);
      }
    }

    return Response.json({ success: true, suggestedGenre, suggestedBpm });
  } catch (error) {
    console.error('suggestTrackTags error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});