import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
Deno.serve(async req => {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const client = createClientFromRequest(req);
    const user = await client.auth.me().catch(() => null);
    if (!user?.id) return Response.json({ error: 'Sign in first.' }, { status: 401 });
    const entities = client.asServiceRole.entities;
    const winners = new Map<string, { id: string; category: string; wins: number; votes: number }>();
    for (let skip = 0; skip < 10000; skip += 200) {
      const rows = await entities.LiveBattle.filter({ status: 'completed' }, '-completed_at', 200, skip);
      for (const b of rows) {
        if (!b.winner_id || !['rap', 'singing'].includes(b.category) || !b.video_room_id || !b.completed_at) continue;
        const key = b.category + ':' + b.winner_id;
        const previous = winners.get(key) || { id: b.winner_id, category: b.category, wins: 0, votes: 0 };
        previous.wins++;
        previous.votes += b.winner_id === b.creator_id ? Number(b.creator_votes || 0) : Number(b.opponent_votes || 0);
        winners.set(key, previous);
      }
      if (rows.length < 200) break;
    }
    const rank = category => [...winners.values()].filter(w => w.category === category)
      .sort((a,b) => b.wins - a.wins || b.votes - a.votes).slice(0, 20);
    const decorate = async rows => Promise.all(rows.map(async row => {
      const artist = await entities.User.get(row.id).catch(() => null);
      return { ...row, artist_name: String(artist?.display_name || artist?.full_name || 'Artist').slice(0, 60) };
    }));
    return Response.json({ success: true, rap: await decorate(rank('rap')), singing: await decorate(rank('singing')), scoring: 'Completed battle wins, then audience votes.' });
  } catch (error) {
    console.error('listBattleAwards failed', error);
    return Response.json({ error: 'Could not load awards.' }, { status: 500 });
  }
});