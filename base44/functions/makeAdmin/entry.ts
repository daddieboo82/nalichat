import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

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

    const { email } = await readJsonBodyLimited(req, 8 * 1024);
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 320) {
      return Response.json({ error: 'A valid email is required' }, { status: 400 });
    }

    const users = await base44.asServiceRole.entities.User.filter({ email: normalizedEmail }, '-created_date', 2);
    if (users.length > 1) {
      return Response.json({ error: 'Multiple users match this email; manual reconciliation is required' }, { status: 409 });
    }
    const target = users[0];
    if (!target) {
      return Response.json({ error: 'No matching user found' }, { status: 404 });
    }

    await base44.asServiceRole.entities.User.update(target.id, { role: 'admin' });

    const updated = await base44.asServiceRole.entities.User.get(target.id);
    if (!updated || updated.role !== 'admin') {
      return Response.json({ error: 'Admin promotion was not confirmed' }, { status: 500 });
    }
    return Response.json({
      success: true,
      action: 'promote_admin',
      adminUserId: caller.id,
      targetUserId: target.id,
      role: updated.role,
    });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('makeAdmin error:', error);
    return Response.json({ error: 'Admin promotion failed' }, { status: 500 });
  }
});