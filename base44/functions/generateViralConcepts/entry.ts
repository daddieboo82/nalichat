import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requireEntitlement, preferredAiModel } from '../../shared/entitlementAccess.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import {
  AiQuotaError,
  aiQuotaErrorResponse,
  executeMeteredAiRequest,
} from '../../shared/aiQuota.ts';

const MOODS = new Set(['all', 'humor', 'shock', 'curiosity', 'relatable', 'controversy', 'awe']);

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    concepts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          hook: { type: 'string' },
          emotional_trigger: { type: 'string' },
          tiktok_script: { type: 'string' },
          reddit_post: { type: 'string' },
          discord_message: { type: 'string' },
          x_thread: { type: 'string' },
          youtube_shorts_script: { type: 'string' },
          viral_loop: { type: 'string' },
          hashtags: { type: 'array', items: { type: 'string' } },
          communities: { type: 'array', items: { type: 'string' } },
          screenshot_caption: { type: 'string' },
          cta: { type: 'string' },
        },
      },
    },
  },
};

function buildPrompt(mood: string) {
  return `You are ViralSeed AI — an autonomous engine that creates and optimizes viral content for NaliChat, a music collaboration platform at nalichat.org.

Generate exactly 5 specific viral content concepts for music creators. For each concept provide: title, hook, emotional_trigger, tiktok_script, reddit_post, discord_message, x_thread, youtube_shorts_script, viral_loop, hashtags, communities, screenshot_caption, and a CTA to nalichat.org.

Optimize for authentic music culture and early engagement. Emotional emphasis: ${mood === 'all' ? 'awe, humor, surprise, validation, curiosity' : mood}. Do not fabricate real-world claims or impersonate real people.`;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_banned) {
      return Response.json({ error: 'banned' }, { status: 403 });
    }
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const { allowed, entitlements } = await requireEntitlement(
      base44.asServiceRole.entities,
      user.id,
      'ai.standard',
    );
    if (!allowed) {
      return Response.json({ error: 'Premium is required for ViralSeed AI' }, { status: 403 });
    }

    const rate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'viral_seed',
      20,
    );
    if (!rate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const body = await readJsonBodyLimited(req, 8 * 1024);
    const mood = MOODS.has(body?.mood) ? body.mood : 'all';

    const { result, quota } = await executeMeteredAiRequest({
      base44,
      user,
      operation: 'viral_seed',
      requestKey: body?.request_key,
      dispatch: () => base44.asServiceRole.integrations.Core.InvokeLLM({
        ...(preferredAiModel(entitlements) ? { model: preferredAiModel(entitlements) } : {}),
        prompt: buildPrompt(mood),
        response_json_schema: RESPONSE_SCHEMA,
      }),
    });

    const concepts = Array.isArray(result?.concepts) ? result.concepts.slice(0, 5) : [];
    if (concepts.length === 0) {
      return Response.json({ error: 'No concepts generated' }, { status: 502 });
    }

    const entities = base44.asServiceRole.entities;
    const achievementId = `achievement_viral_seed_${user.id}`;
    let firstGeneration = false;

    try {
      await entities.Achievement.create({
        id: achievementId,
        user_id: user.id,
        key: 'viral_seed',
        title: 'Viral Seed',
        description: 'Generated your first viral content concepts with ViralSeed AI',
        icon: 'rocket',
        xp: 50,
        category: 'creative',
      });
      firstGeneration = true;
    } catch (createError) {
      const existing = await entities.Achievement.get(achievementId).catch(() => null);
      if (!(existing?.user_id === user.id && existing?.key === 'viral_seed')) {
        throw createError;
      }
    }

    try {
      await entities.User.updateMany(
        { id: user.id },
        { $inc: {
          viral_concepts_generated: concepts.length,
          ...(firstGeneration ? { xp: 50 } : {}),
        } },
      );
    } catch (updateError) {
      // If the first award failed to reach the user record, remove the
      // achievement claim so a retry can award it correctly.
      if (firstGeneration) {
        try {
          await entities.Achievement.delete(achievementId);
        } catch (rollbackError) {
          console.error('ViralSeed achievement rollback failed:', rollbackError);
          throw new Error(
            'ViralSeed XP update failed and achievement rollback was incomplete. Please retry.',
            { cause: updateError },
          );
        }
      }
      throw updateError;
    }

    return Response.json({ concepts, xp_awarded: firstGeneration ? 50 : 0, quota });
  } catch (error) {
    if (error instanceof AiQuotaError) return aiQuotaErrorResponse(error);
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('generateViralConcepts error:', error);
    return Response.json({ error: 'Viral generation failed' }, { status: 500 });
  }
});
