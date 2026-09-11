import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { userId } = await req.json();
    if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 });

    const rows = await base44.asServiceRole.entities.Achievement.filter({ user_id: userId });
    return Response.json({
      achievements: rows.map((a) => ({
        id: a.id,
        user_id: a.user_id,
        key: a.key,
        title: a.title,
        description: a.description,
        icon: a.icon,
        xp: a.xp,
        category: a.category,
        created_date: a.created_date,
      })),
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Could not load achievements' }, { status: 500 });
  }
});
