import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Security: only an existing admin can promote users
    const caller = await base44.auth.me();
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin role required' }, { status: 403 });
    }
    if (caller.is_banned) return Response.json({ error: 'banned' }, { status: 403 });
    if (caller.timeout_until && new Date(caller.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: caller.timeout_until }, { status: 403 });
    }

    const adminRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      caller.id,
      'admin_promote_user',
      30,
    );
    if (!adminRate.allowed) {
      return Response.json({ error: 'Admin operation rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const { email } = await req.json();
    if (!email) {
      return Response.json({ error: 'email is required' }, { status: 400 });
    }

    const users = await base44.asServiceRole.entities.User.filter({ email }, '-created_date', 1);
    const target = users[0];
    if (!target) {
      return Response.json({ error: `No user found with email ${email}` }, { status: 404 });
    }

    await base44.asServiceRole.entities.User.update(target.id, { role: 'admin' });

    const updated = await base44.asServiceRole.entities.User.filter({ email }, '-created_date', 1);
    return Response.json({ success: true, email, role: updated[0]?.role });
  } catch (error) {
    console.error('makeAdmin error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});