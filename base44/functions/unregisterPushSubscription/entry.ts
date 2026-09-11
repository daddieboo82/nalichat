import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const endpoint = String(body?.endpoint || '').trim();
    if (!endpoint || !endpoint.startsWith('https://')) {
      return Response.json({ error: 'Invalid push subscription endpoint' }, { status: 400 });
    }

    const entity = base44.asServiceRole.entities.PushSubscription;
    const rows = await entity.filter({ user_id: user.id, endpoint });
    for (const row of rows) {
      await entity.delete(row.id);
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error?.message || 'Could not unregister push subscription' }, { status: 500 });
  }
});
