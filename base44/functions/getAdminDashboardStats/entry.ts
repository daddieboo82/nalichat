import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all subscriptions using service role
    const subscriptions = await base44.asServiceRole.entities.Subscription.filter({});

    return Response.json({ subscriptions });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});