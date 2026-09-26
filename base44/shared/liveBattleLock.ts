export async function withBattleLock(entities: any, battleId: string, work: () => Promise<Response>): Promise<Response> {
  const id = 'live_battle_lock_' + battleId;
  const now = Date.now();
  const create = () => entities.LiveBattleLifecycleLock.create({
    id, battle_id: battleId, claimed_at: new Date(now).toISOString(),
    expires_at: new Date(now + 120000).toISOString(),
  });
  try {
    await create();
  } catch (error) {
    const existing = await entities.LiveBattleLifecycleLock.get(id).catch(() => null);
    if (!existing) throw error;
    if (Date.parse(existing.expires_at || '') > now) {
      return Response.json({ error: 'Battle is being updated. Retry shortly.' }, { status: 409 });
    }
    await entities.LiveBattleLifecycleLock.delete(id);
    try { await create(); }
    catch { return Response.json({ error: 'Battle is being updated. Retry shortly.' }, { status: 409 }); }
  }
  try { return await work(); }
  finally {
    await entities.LiveBattleLifecycleLock.delete(id).catch(error => console.error('Battle lock release failed', error));
  }
}
