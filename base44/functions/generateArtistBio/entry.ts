import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { requireEntitlement, preferredAiModel } from '../../shared/entitlementAccess.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
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
      return Response.json({ error: 'Premium is required for AI bio generation' }, { status: 403 });
    }

    const rate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'ai_artist_bio',
      30,
    );
    if (!rate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    // Generate a bio ONLY for the requesting user — never bulk-fill other users.
    const prompt = `Generate a professional, engaging 2-3 sentence bio for a music industry professional with the following profile:
Name: ${user.display_name || user.full_name}
Role: ${user.artist_role || user.role || 'Music Professional'}
Location: ${user.location || 'Not specified'}
Genres: ${user.genres?.join(', ') || 'Not specified'}
Website: ${user.website || 'Not specified'}

The bio should be written in first person, highlight their expertise, and sound authentic and inspiring. Keep it concise and suitable for a professional music network profile. Return only the bio text.`;

    const bioResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      ...(preferredAiModel(entitlements) ? { model: preferredAiModel(entitlements) } : {}),
      prompt: prompt,
    });

    const bio = bioResponse.trim();

    return Response.json({ bio });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});