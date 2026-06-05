import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Only an authenticated admin can promote others
    const me = await base44.auth.me();
    if (!me || me.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { email } = await req.json();
    if (!email) {
      return Response.json({ error: 'email is required' }, { status: 400 });
    }

    const users = await base44.asServiceRole.entities.User.filter({ email });
    const target = users[0];
    if (!target) {
      return Response.json({ error: `No user found with email ${email}` }, { status: 404 });
    }

    await base44.asServiceRole.entities.User.update(target.id, { role: 'admin' });

    return Response.json({ success: true, email, role: 'admin' });
  } catch (error) {
    console.error('makeAdmin error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});