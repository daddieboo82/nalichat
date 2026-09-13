import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('squad activity source validation', () => {
  it('requires canonical source ids before privileged source lookup', async () => {
    const s = await readFile('base44/functions/recordSquadActivity/entry.ts', 'utf8');
    expect(s).toContain('isBase44EntityId(normalizedSourceId)');
    expect(s.indexOf('isBase44EntityId(normalizedSourceId)')).toBeLessThan(s.indexOf('validateSource(entities, user, sourceType, normalizedSourceId)'));
  });
});


  it('binds activity confirmation to the authenticated user and exact source', async () => {
    const backend = await readFile('base44/functions/recordSquadActivity/entry.ts', 'utf8');
    const client = await readFile('src/lib/squadBonus.js', 'utf8');
    expect(backend).toContain("action: 'record_squad_activity'");
    expect(backend).toContain('userId: user.id');
    expect(backend).toContain('sourceId: normalizedSourceId');
    expect(client).toContain('data?.userId !== expectedUserId');
    expect(client).toContain('data?.sourceType !== sourceType');
    expect(client).toContain('data?.sourceId !== sourceId');
  });
