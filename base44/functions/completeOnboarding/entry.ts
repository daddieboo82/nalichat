import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

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
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
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
    return Response.json({ success: true });
  } catch (error) {
    console.error('completeOnboarding error:', error);
    return Response.json({ error: error?.message || 'Could not complete onboarding' }, { status: 500 });
  }
});
