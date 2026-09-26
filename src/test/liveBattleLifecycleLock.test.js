import { describe, expect, it } from 'vitest';
import { withBattleLock } from '../../base44/shared/liveBattleLock.ts';

function store(initial) {
  const records = new Map(initial ? [[initial.id, initial]] : []);
  return {
    LiveBattleLifecycleLock: {
      create: async (record) => {
        if (records.has(record.id)) throw new Error('duplicate');
        records.set(record.id, record);
      },
      get: async (id) => records.get(id) || null,
      delete: async (id) => { records.delete(id); },
    },
    records,
  };
}

describe('live battle lifecycle lock', () => {
  it('blocks simultaneous vote or finalization work on the same battle', async () => {
    const entities = store();
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const first = withBattleLock(entities, 'battle_one', async () => {
      await gate;
      return Response.json({ first: true });
    });
    await Promise.resolve();
    const second = await withBattleLock(entities, 'battle_one', async () => Response.json({ second: true }));
    expect(second.status).toBe(409);
    release();
    expect((await first).status).toBe(200);
    const third = await withBattleLock(entities, 'battle_one', async () => Response.json({ third: true }));
    expect(third.status).toBe(200);
  });

  it('releases the lock when a mutation throws', async () => {
    const entities = store();
    await expect(withBattleLock(entities, 'battle_two', async () => { throw new Error('failed'); })).rejects.toThrow('failed');
    expect(entities.records.size).toBe(0);
  });

  it('recovers an expired lock from an interrupted request', async () => {
    const id = 'live_battle_lock_battle_three';
    const entities = store({ id, battle_id: 'battle_three', expires_at: new Date(Date.now() - 1000).toISOString() });
    const result = await withBattleLock(entities, 'battle_three', async () => Response.json({ recovered: true }));
    expect(result.status).toBe(200);
    expect(entities.records.size).toBe(0);
  });
});