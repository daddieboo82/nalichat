import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { userId } = await req.json();
    if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 });

    const target = await base44.asServiceRole.entities.User.get(String(userId)).catch(() => null);
    if (
      !target
      || !target.onboarding_completed
      || target.is_banned
      || !String(target.display_name || '').trim()
    ) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    const rows = await base44.asServiceRole.entities.Achievement.filter({ user_id: target.id });
    return Response.json({
      achievements: rows.map((a) => ({ key: a.key })),
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Could not load achievements' }, { status: 500 });
  }
});
