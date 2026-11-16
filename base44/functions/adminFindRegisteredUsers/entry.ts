import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

const PAGE_SIZE = 25;
Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const admin = await base44.auth.me();
    if (!admin?.id || admin.role !== 'admin' || admin.is_banned ||
        (admin.timeout_until && Date.parse(admin.timeout_until) > Date.now())) {
      return Response.json({ error: 'Administrator authorization required' }, { status: 403 });
    }
    const limited = await consumeHourlyLimit(base44.asServiceRole.entities, admin.id, 'admin_find_registered_users', 120);
    if (!limited.allowed) return Response.json({ error: 'Please try again later.' }, { status: 429 });
    const body = await readJsonBodyLimited(req, 2048);
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const page = Number(body?.page ?? 0);
    if (!Number.isInteger(page) || page < 0 || page > 100 || email.length > 254 ||
        (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return Response.json({ error: 'Enter a valid email address or page.' }, { status: 400 });
    }
    const users = base44.asServiceRole.entities.User;
    const filter = email ? { email } : {};
    const list = await users.filter(filter, '-created_date', PAGE_SIZE + 1, page * PAGE_SIZE);
    if (!Array.isArray(list)) throw new Error('Invalid user lookup response');
    const records = list.slice(0, PAGE_SIZE).map((user: any) => ({
      id: user.id,
      email: user.email || '',
      displayName: user.display_name || user.full_name || '',
      createdAt: user.created_date || null,
      role: user.role === 'admin' ? 'admin' : 'user',
      onboardingCompleted: user.onboarding_completed === true,
    }));
    return Response.json({
      success: true,
      action: 'admin_find_registered_users',
      adminUserId: admin.id,
      page,
      hasMore: list.length > PAGE_SIZE,
      exactEmailSearch: !!email,
      users: records,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('Admin registered-user lookup unavailable');
    return Response.json({ error: 'Unable to retrieve registered users.' }, { status: 500 });
  }
});
