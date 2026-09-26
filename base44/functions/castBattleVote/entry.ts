import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { withBattleLock } from '../../shared/liveBattleLock.ts';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const client = createClientFromRequest(req);
    const user = await client.auth.me();
    if (!user?.id) return Response.json({ error: 'Sign in to vote.' }, { status: 401 });
    if (user.is_banned || (user.timeout_until && Date.parse(user.timeout_until) > Date.now())) {
      return Response.json({ error: 'Voting is unavailable for this account.' }, { status: 403 });
    }
    const { battleId, performerId } = await req.json();
    if (typeof battleId !== 'string' || !/^[a-z0-9_-]{10,80}$/i.test(battleId) || typeof performerId !== 'string') {
      return Response.json({ error: 'Invalid vote.' }, { status: 400 });
    }
    const entities = client.asServiceRole.entities;
    const rate = await consumeHourlyLimit(entities, user.id, 'live_battle_vote', 30);
    if (!rate.allowed) return Response.json({ error: 'Too many vote attempts.' }, { status: 429 });
    return await withBattleLock(entities, battleId, async () => {
      const battle = await entities.LiveBattle.get(battleId).catch(() => null);
      if (!battle) return Response.json({ error: 'Battle not found.' }, { status: 404 });
      if (battle.status !== 'voting' || !battle.video_room_id || !battle.voting_end_at
        || Date.parse(battle.voting_end_at) <= Date.now()) {
        return Response.json({ error: 'Voting is closed.' }, { status: 409 });
      }
      if (!battle.opponent_id || (performerId !== battle.creator_id && performerId !== battle.opponent_id)) {
        return Response.json({ error: 'Invalid performer.' }, { status: 400 });
      }
      if (user.id === battle.creator_id || user.id === battle.opponent_id) {
        return Response.json({ error: 'Performers cannot vote in their own battle.' }, { status: 403 });
      }
      const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(battleId + ':' + user.id));
      const id = 'battle_vote_' + Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
      const existing = await entities.LiveBattleVote.get(id).catch(() => null);
      if (existing) return Response.json({ error: 'You already voted in this battle.' }, { status: 409 });
      await entities.LiveBattleVote.create({ id, battle_id: battleId, voter_id: user.id, performer_id: performerId });
      return Response.json({ success: true, battleId, performerId });
    });
  } catch (error) {
    console.error('castBattleVote failed', error);
    return Response.json({ error: 'Could not record vote.' }, { status: 500 });
  }
});