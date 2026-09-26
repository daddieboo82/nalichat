import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { withBattleLock } from '../../shared/liveBattleLock.ts';
import { RoomServiceClient } from 'npm:livekit-server-sdk@2.19.1';

const criteria = ['musicality', 'originality', 'technique'];
function validRatings(value) {
  return value && typeof value === 'object'
    && criteria.every(key => Number.isInteger(value[key]) && value[key] >= 1 && value[key] <= 5);
}

Deno.serve(async req => {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const client = createClientFromRequest(req);
    const user = await client.auth.me().catch(() => null);
    if (!user?.id) return Response.json({ error: 'Sign in to score.' }, { status: 401 });
    if (user.is_banned || (user.timeout_until && Date.parse(user.timeout_until) > Date.now())) return Response.json({ error: 'Scoring unavailable for this account.' }, { status: 403 });
    const { battleId, creator, opponent } = await req.json();
    if (typeof battleId !== 'string' || !/^[a-z0-9_-]{10,80}$/i.test(battleId)
      || !validRatings(creator) || !validRatings(opponent)) {
      return Response.json({ error: 'Rate both artists 1–5 on musicality, originality, and technique.' }, { status: 400 });
    }
    const entities = client.asServiceRole.entities;
    const rate = await consumeHourlyLimit(entities, user.id, 'live_battle_vote', 30);
    if (!rate.allowed) return Response.json({ error: 'Too many scoring attempts.' }, { status: 429 });
    return await withBattleLock(entities, battleId, async () => {
      const battle = await entities.LiveBattle.get(battleId).catch(() => null);
      if (!battle) return Response.json({ error: 'Battle not found.' }, { status: 404 });
      if (battle.status !== 'voting' || !battle.video_room_id || !battle.voting_end_at
        || Date.parse(battle.voting_end_at) <= Date.now()) {
        return Response.json({ error: 'Scoring is closed.' }, { status: 409 });
      }
      if (!battle.opponent_id || user.id === battle.creator_id || user.id === battle.opponent_id) {
        return Response.json({ error: 'Performers cannot score their own battle.' }, { status: 403 });
      }
      const url = Deno.env.get('LIVEKIT_URL') || '';
      const key = Deno.env.get('LIVEKIT_API_KEY') || '';
      const secret = Deno.env.get('LIVEKIT_API_SECRET') || '';
      if (!url || !key || !secret) return Response.json({ error: 'Live audience unavailable.' }, { status: 503 });
      const service = new RoomServiceClient(url.replace(/^wss:/, 'https:'), key, secret);
      const participants = await service.listParticipants(battle.video_room_id).catch(() => []);
      if (!participants.some(participant => participant.identity === user.id)) {
        return Response.json({ error: 'Join the live audience before scoring.' }, { status: 403 });
      }
      const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(battleId + ':' + user.id));
      const id = 'battle_vote_' + Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
      if (await entities.LiveBattleVote.get(id).catch(() => null)) return Response.json({ error: 'You already scored this battle.' }, { status: 409 });
      await entities.LiveBattleVote.create({
        id, battle_id: battleId, voter_id: user.id,
        creator_musicality: creator.musicality, creator_originality: creator.originality, creator_technique: creator.technique,
        opponent_musicality: opponent.musicality, opponent_originality: opponent.originality, opponent_technique: opponent.technique,
      });
      return Response.json({ success: true, battleId, action: 'score_both_performers' });
    });
  } catch (error) {
    console.error('castBattleVote failed', error);
    return Response.json({ error: 'Could not record score.' }, { status: 500 });
  }
});