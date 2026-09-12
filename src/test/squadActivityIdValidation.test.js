import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('squad activity source validation', () => {
  it('requires canonical source ids before privileged source lookup', async () => {
    const s = await readFile('base44/functions/recordSquadActivity/entry.ts', 'utf8');
    expect(s).toContain('isBase44EntityId(normalizedSourceId)');
    expect(s.indexOf('isBase44EntityId(normalizedSourceId)')).toBeLessThan(s.indexOf('validateSource(entities, user, sourceType, normalizedSourceId)'));
  });
});
