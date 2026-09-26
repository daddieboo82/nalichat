import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
Deno.serve(async req => {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const client = createClientFromRequest(req);
    const user = await client.auth.me().catch(() => null);
    if (!user?.id) return Response.json({ error: 'Sign in first.' }, { status: 401 });
    const { battleId } = await req.json();
    if (typeof battleId !== 'string' || !/^[a-z0-9_-]{10,80}$/i.test(battleId)) return Response.json({ error: 'Invalid battle.' }, { status: 400 });
    const entities = client.asServiceRole.entities;
    const battle = await entities.LiveBattle.get(battleId).catch(() => null);
    if (!battle || !['live','voting','completed'].includes(battle.status)) return Response.json({ error: 'Battle unavailable.' }, { status: 404 });
    const latestBucket = Math.floor(Date.now() / 3000);
    let count = 0;
    const byKind = { fire: 0, cheer: 0, love: 0 };
    for (let skip = 0; skip < 5000; skip += 200) {
      const page = await entities.LiveBattleReaction.filter({ battle_id: battleId }, '-created_date', 200, skip);
      for (const item of page) {
        if (item.bucket >= latestBucket - 19 && item.bucket <= latestBucket && item.reaction in byKind) {
          count++;
          byKind[item.reaction]++;
        }
      }
      if (page.length < 200 || page.some(item => item.bucket < latestBucket - 19)) break;
    }
    return Response.json({ success: true, windowSeconds: 60, count, byKind });
  } catch (error) {
    console.error('getBattleReactions failed', error);
    return Response.json({ error: 'Could not load reactions.' }, { status: 500 });
  }
});