import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
const reasons = new Set(['spam','harassment','hate_speech','violence','sexual_content','illegal_activity','other']);
const categories = { spam:'bullying', harassment:'bullying', hate_speech:'racism', violence:'violence', sexual_content:'sexual_violence', illegal_activity:'illegal_activity', other:'bullying' };
Deno.serve(async req => {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const client = createClientFromRequest(req);
    const reporter = await client.auth.me().catch(() => null);
    if (!reporter?.id) return Response.json({ error: 'Sign in first.' }, { status: 401 });
    if (reporter.is_banned) return Response.json({ error: 'Not allowed.' }, { status: 403 });
    const body = await req.json();
    const battleId = String(body?.battleId || '');
    const targetId = String(body?.targetId || '');
    const reason = reasons.has(body?.reason) ? body.reason : 'other';
    if (!/^[a-z0-9_-]{10,80}$/i.test(battleId)) return Response.json({ error: 'Invalid battle.' }, { status: 400 });
    const entities = client.asServiceRole.entities;
    const battle = await entities.LiveBattle.get(battleId).catch(() => null);
    if (!battle || !['live','voting','completed'].includes(battle.status)
      || ![battle.creator_id,battle.opponent_id].includes(targetId) || targetId === reporter.id) {
      return Response.json({ error: 'Cannot report this performer.' }, { status: 403 });
    }
    const rate = await consumeHourlyLimit(entities, reporter.id, 'battle_report', 10);
    if (!rate.allowed) return Response.json({ error: 'Report limit reached.' }, { status: 429 });
    await entities.Violation.create({
      user_id: targetId, category: categories[reason], severity: 'medium',
      content: 'Live battle report: ' + reason + ' · ' + battle.title.slice(0, 100),
      content_type: 'other', content_id: battleId, review_status: 'pending',
      reported_by_id: reporter.id, reported_by_name: reporter.display_name || 'User',
    });
    return Response.json({ success: true, action: 'battle_report' });
  } catch (error) {
    console.error('reportBattle failed', error);
    return Response.json({ error: 'Could not submit report.' }, { status: 500 });
  }
});