import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
Deno.serve(async req => {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const client = createClientFromRequest(req);
    const user = await client.auth.me().catch(() => null);
    if (!user?.id) return Response.json({ error: 'Sign in first.' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const battleId = typeof body.battleId === 'string' ? body.battleId : '';
    const entities = client.asServiceRole.entities;
    const rows = battleId
      ? [await entities.LiveBattle.get(battleId).catch(() => null)].filter(Boolean)
      : await entities.LiveBattle.list('-created_date', 100);
    const battles = rows.filter(b => ['live', 'voting', 'completed'].includes(b.status)).map(b => ({
      id: b.id, title: b.title, category: b.category, status: b.status,
      creator_id: b.creator_id, creator_name: b.creator_name,
      opponent_id: b.opponent_id, creator_track_url: b.creator_track_url,
      creator_track_name: b.creator_track_name, opponent_track_url: b.opponent_track_url,
      opponent_track_name: b.opponent_track_name, voting_end_at: b.voting_end_at,
      winner_id: b.winner_id, creator_votes: b.creator_votes, opponent_votes: b.opponent_votes,
      award_title: b.award_title,
    }));
    return Response.json({ success: true, battles });
  } catch (error) {
    console.error('listLiveBattles failed', error);
    return Response.json({ error: 'Could not load battles.' }, { status: 500 });
  }
});