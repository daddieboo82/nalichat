import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const endpoint = String(body?.endpoint || '');
    const p256dh = String(body?.keys?.p256dh || '');
    const auth = String(body?.keys?.auth || '');

    if (!endpoint || !p256dh || !auth || !endpoint.startsWith('https://')) {
      return Response.json({ error: 'Invalid push subscription' }, { status: 400 });
    }

    const entity = base44.asServiceRole.entities.PushSubscription;
    const endpointRows = await entity.filter({ endpoint });
    const existing = endpointRows.find((row: any) => row.user_id === user.id);

    // A browser push endpoint identifies a device/browser subscription. Keep it
    // associated with only the account that most recently registered it.
    for (const row of endpointRows) {
      if (row.user_id !== user.id) {
        await entity.delete(row.id);
      }
    }

    const data = {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: String(body?.userAgent || '').slice(0, 500),
      last_seen_at: new Date().toISOString(),
    };

    if (existing) {
      await entity.update(existing.id, data);
    } else {
      await entity.create(data);
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error?.message || 'Could not register push subscription' }, { status: 500 });
  }
});
