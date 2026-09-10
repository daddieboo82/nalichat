import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
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
  const emotionalTrigger = mood === 'all'
    ? 'awe, humor, anger, surprise, validation, or curiosity'
    : mood;
  return `You are ViralSeed AI. Generate 5 specific, authentic viral content concepts for music creators using ${emotionalTrigger} as the emotional trigger.

For each concept include a title, hook, TikTok/Reels script, Reddit post, Discord message, X thread, YouTube Shorts script, viral loop, hashtags, communities, screenshot caption, and a CTA to nalichat.org. Optimize for early engagement and format each item naturally for its platform.`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const mood = MOODS.has(body?.mood) ? body.mood : 'all';
    const { result, quota } = await executeMeteredAiRequest({
      base44,
      user,
      operation: 'viral_concepts',
      requestKey: body?.request_key,
      dispatch: () => base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: buildPrompt(mood),
        response_json_schema: RESPONSE_SCHEMA,
      }),
    });

    return Response.json({ ...result, quota });
  } catch (error) {
    if (error instanceof AiQuotaError) return aiQuotaErrorResponse(error);
    console.error('generateViralConcepts error:', error);
    const message = error instanceof Error ? error.message : 'Unable to generate viral concepts';
    return Response.json({ error: message }, { status: 500 });
  }
});
