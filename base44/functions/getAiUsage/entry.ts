import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { utcUsageWindow } from '../../shared/aiQuota.ts';

const PAGE_SIZE = 500;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin role required' }, { status: 403 });
    }

    const body = req.method === 'GET' ? {} : await req.json();
    const { utcDay } = utcUsageWindow(body?.day ? `${body.day}T00:00:00.000Z` : new Date());
    const query: Record<string, unknown> = { utc_day: utcDay };
    if (typeof body?.user_id === 'string' && body.user_id) query.user_id = body.user_id;

    const records = [];
    for (let skip = 0; ; skip += PAGE_SIZE) {
      const page = await base44.asServiceRole.entities.AIUsage.filter(
        query,
        '-created_date',
        PAGE_SIZE,
        skip,
      );
      records.push(...page);
      if (page.length < PAGE_SIZE) break;
    }

    const dispatched = records.filter((record) => record.status === 'dispatched');
    const byOperation = dispatched.reduce((counts, record) => {
      const operation = typeof record.operation === 'string' ? record.operation : 'unknown';
      counts[operation] = (counts[operation] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    const byAccount = dispatched.reduce((counts, record) => {
      counts[record.user_id] = (counts[record.user_id] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    return Response.json({
      day: utcDay,
      total: dispatched.length,
      reserved: records.length - dispatched.length,
      by_operation: byOperation,
      by_account: byAccount,
    });
  } catch (error) {
    console.error('getAiUsage error:', error);
    const message = error instanceof Error ? error.message : 'Unable to load AI usage';
    return Response.json({ error: message }, { status: 500 });
  }
});
