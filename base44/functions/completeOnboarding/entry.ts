import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

function validBirthdate(value: unknown) {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const parsed = new Date(raw + 'T00:00:00Z');
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.toISOString().slice(0, 10) !== raw) return null;
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  if (parsed.getTime() > todayUtc) return null;
  return raw;
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
      'onboarding_complete',
      20,
    );
    if (!writeRate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const body = await readJsonBodyLimited(req, 16 * 1024);
    const displayName = String(body?.display_name || '').trim().slice(0, 120);
    const birthdate = validBirthdate(body?.birthdate);

    if (!displayName || !birthdate) {
      return Response.json({ error: 'A display name and valid birthdate are required' }, { status: 400 });
    }

    const patch = {
      display_name: displayName,
      birthdate,
      bio: String(body?.bio || '').trim().slice(0, 2000),
      location: String(body?.location || '').trim().slice(0, 200),
      onboarding_completed: true,
    };

    await base44.asServiceRole.entities.User.update(user.id, patch);
    return Response.json({
      success: true,
      action: 'complete_onboarding',
      userId: user.id,
      onboardingCompleted: true,
    });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('completeOnboarding error:', error);
    return Response.json({ error: 'Could not complete onboarding' }, { status: 500 });
  }
});
