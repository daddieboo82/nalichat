import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
const kinds = new Set(['fire','cheer','love']);
Deno.serve(async req => {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const client = createClientFromRequest(req);
    const user = await client.auth.me().catch(() => null);
    if (!user?.id) return Response.json({ error: 'Sign in to react.' }, { status: 401 });
    if (user.is_banned || (user.timeout_until && Date.parse(user.timeout_until) > Date.now())) return Response.json({ error: 'Reactions unavailable.' }, { status: 403 });
    const body = await req.json();
    const battleId = String(body?.battleId || '');
    const reaction = String(body?.reaction || '');
    if (!/^[a-z0-9_-]{10,80}$/i.test(battleId) || !kinds.has(reaction)) return Response.json({ error: 'Invalid reaction.' }, { status: 400 });
    const entities = client.asServiceRole.entities;
    const battle = await entities.LiveBattle.get(battleId).catch(() => null);
    if (!battle || battle.status !== 'live') return Response.json({ error: 'Reactions are closed.' }, { status: 409 });
    if (user.id === battle.creator_id || user.id === battle.opponent_id) return Response.json({ error: 'Audience reactions are for viewers.' }, { status: 403 });
    const rate = await consumeHourlyLimit(entities, user.id, 'battle_reaction', 100);
    if (!rate.allowed) return Response.json({ error: 'Reaction limit reached.' }, { status: 429 });
    const bucket = Math.floor(Date.now() / 3000);
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(battleId + ':' + user.id + ':' + bucket));
    const id = 'battle_reaction_' + Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
    try { await entities.LiveBattleReaction.create({ id, battle_id: battleId, user_id: user.id, reaction, bucket }); }
    catch {
      return Response.json({ error: 'Wait a moment before reacting again.' }, { status: 429 });
    }
    return Response.json({ success: true, reaction });
  } catch (error) {
    console.error('reactBattle failed', error);
    return Response.json({ error: 'Could not send reaction.' }, { status: 500 });
  }
});