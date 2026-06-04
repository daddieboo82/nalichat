import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { isOnline } = await req.json();

    // Update user's online status
    await base44.asServiceRole.entities.User.update(user.id, {
      is_online: isOnline === true,
      last_seen: new Date().toISOString(),
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error updating user presence:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});