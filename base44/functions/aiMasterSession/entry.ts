import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { requireEntitlement, preferredAiModel } from '../../shared/entitlementAccess.ts';

// Returns concrete, numeric mastering parameters that the client applies via WebAudio
// to automatically produce an industry-ready master from stacked stems.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { allowed, entitlements } = await requireEntitlement(
      base44.asServiceRole.entities,
      user.id,
      'ai.standard',
    );
    if (!allowed) {
      return Response.json({ error: 'Premium is required for AI mastering' }, { status: 403 });
    }

    const { project_title, genre, bpm, stems } = await req.json();

    const stemSummary = Array.isArray(stems)
      ? stems.map(s => `- ${s.name} (${s.type || 'unknown'})`).join('\n')
      : 'unknown';

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      ...(preferredAiModel(entitlements) ? { model: preferredAiModel(entitlements) } : {}),
      prompt: `You are a world-class mastering engineer. Produce concrete, numeric processing settings to turn a multi-stem mix into an industry-ready, streaming-loud master.

Project: "${project_title}"
${genre ? `Genre: ${genre}` : ''}
${bpm ? `BPM: ${bpm}` : ''}
Stems being mixed:
${stemSummary}

Return precise DSP parameters tailored to this genre. Target streaming loudness around -14 LUFS with a true-peak ceiling of -1 dB.
- low_shelf: { freq_hz, gain_db } — low-end shaping
- low_mid: { freq_hz, gain_db, q } — control mud (200-500Hz)
- presence: { freq_hz, gain_db, q } — vocal/instrument clarity (2-5kHz)
- high_shelf: { freq_hz, gain_db } — air/brightness
- compressor: { threshold_db, ratio, attack_s, release_s, knee_db } — glue compression
- makeup_gain_db — overall level boost after compression
- limiter_ceiling_db — final brickwall ceiling (negative dB, around -1)
gain_db values should be modest (-6 to +6). ratio 1.5-4. attack 0.003-0.05. release 0.05-0.4.`,
      response_json_schema: {
        type: "object",
        properties: {
          low_shelf: { type: "object", properties: { freq_hz: { type: "number" }, gain_db: { type: "number" } } },
          low_mid: { type: "object", properties: { freq_hz: { type: "number" }, gain_db: { type: "number" }, q: { type: "number" } } },
          presence: { type: "object", properties: { freq_hz: { type: "number" }, gain_db: { type: "number" }, q: { type: "number" } } },
          high_shelf: { type: "object", properties: { freq_hz: { type: "number" }, gain_db: { type: "number" } } },
          compressor: { type: "object", properties: { threshold_db: { type: "number" }, ratio: { type: "number" }, attack_s: { type: "number" }, release_s: { type: "number" }, knee_db: { type: "number" } } },
          makeup_gain_db: { type: "number" },
          limiter_ceiling_db: { type: "number" },
          notes: { type: "string" }
        },
        required: ["low_shelf", "low_mid", "presence", "high_shelf", "compressor", "makeup_gain_db", "limiter_ceiling_db"]
      }
    });

    return Response.json(result);
  } catch (error) {
    console.error('aiMasterSession error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});