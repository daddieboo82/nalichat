import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Forbidden: Login required' }, { status: 403 });
    }

    // Security: only admins may access platform-wide stats
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin role required' }, { status: 403 });
    }

    // Fetch all subscriptions using service role
    const subscriptions = await base44.asServiceRole.entities.Subscription.filter({});
    const users = await base44.asServiceRole.entities.User.filter({});

    return Response.json({ subscriptions, users });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});