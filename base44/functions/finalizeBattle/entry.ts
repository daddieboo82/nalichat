import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { withBattleLock } from '../../shared/liveBattleLock.ts';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const client = createClientFromRequest(req);
    const user = await client.auth.me().catch(() => null);
    if (!user?.id) return Response.json({ error: 'Sign in first.' }, { status: 401 });
    const { battleId } = await req.json();
    if (typeof battleId !== 'string' || !/^[a-z0-9_-]{10,80}$/i.test(battleId)) {
      return Response.json({ error: 'Invalid battle.' }, { status: 400 });
    }
    const entities = client.asServiceRole.entities;
    return await withBattleLock(entities, battleId, async () => {
      const battle = await entities.LiveBattle.get(battleId).catch(() => null);
      if (!battle) return Response.json({ error: 'Battle not found.' }, { status: 404 });
      if (battle.status === 'completed') return Response.json({
        success: true, alreadyComplete: true, winnerId: battle.winner_id || null,
        creatorVotes: battle.creator_votes, opponentVotes: battle.opponent_votes,
      });
      if (user.id !== battle.creator_id && user.id !== battle.opponent_id && user.role !== 'admin') {
        return Response.json({ error: 'Only a performer can close this battle.' }, { status: 403 });
      }
      if (battle.status !== 'voting' || !battle.video_room_id || !battle.opponent_id
        || !battle.voting_end_at || !Number.isFinite(Date.parse(battle.voting_end_at))
        || Date.parse(battle.voting_end_at) > Date.now()) {
        return Response.json({ error: 'Voting has not finished.' }, { status: 409 });
      }
      let creatorVotes = 0;
      let opponentVotes = 0;
      for (let skip = 0; ; skip += 200) {
        const votes = await entities.LiveBattleVote.filter({ battle_id: battleId }, '-created_date', 200, skip);
        for (const vote of votes) {
          if (vote.performer_id === battle.creator_id) creatorVotes++;
          else if (vote.performer_id === battle.opponent_id) opponentVotes++;
        }
        if (votes.length < 200) break;
      }
      const winnerId = creatorVotes === opponentVotes ? '' :
        (creatorVotes > opponentVotes ? battle.creator_id : battle.opponent_id);
      const awardTitle = winnerId ? (battle.category === 'rap' ? 'Battle Winner · Rap' : 'Battle Winner · Singing') : '';
      await entities.LiveBattle.update(battleId, {
        status: 'completed', completed_at: new Date().toISOString(),
        creator_votes: creatorVotes, opponent_votes: opponentVotes,
        winner_id: winnerId, award_title: awardTitle,
      });
      return Response.json({ success: true, winnerId: winnerId || null, creatorVotes, opponentVotes, awardTitle });
    });
  } catch (error) {
    console.error('finalizeBattle failed', error);
    return Response.json({ error: 'Could not finalize battle.' }, { status: 500 });
  }
});