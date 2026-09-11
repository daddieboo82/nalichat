import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

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
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const mood = MOODS.has(body?.mood) ? body.mood : 'all';

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: buildPrompt(mood),
      response_json_schema: RESPONSE_SCHEMA,
    });

    const concepts = Array.isArray(result?.concepts) ? result.concepts.slice(0, 5) : [];
    if (concepts.length === 0) {
      return Response.json({ error: 'No concepts generated' }, { status: 502 });
    }

    const entities = base44.asServiceRole.entities;
    const priorCount = Number(user.viral_concepts_generated || 0);

    const xpAwarded = priorCount === 0 ? 50 : 0;
    await entities.User.updateMany(
      { id: user.id },
      { $inc: { xp: xpAwarded, viral_concepts_generated: concepts.length } },
    );

    if (priorCount === 0) {
      const achievementId = `achievement_viral_seed_${user.id}`;
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
      } catch {
        // Deterministic ID makes the first-generation achievement idempotent.
      }
    }

    return Response.json({ concepts, xp_awarded: xpAwarded });
  } catch (error) {
    console.error('generateViralConcepts error:', error);
    return Response.json({ error: error?.message || 'Viral generation failed' }, { status: 500 });
  }
});
