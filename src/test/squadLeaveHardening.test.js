import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('squad leave hardening', () => {
  it('allows moderated users to self-remove while rejecting malformed squad ids before lookup', async () => {
    const s=await readFile('base44/functions/leaveSquad/entry.ts','utf8');
    expect(s).toContain('Moderated users must still be');
    expect(s).not.toContain('user.is_banned');
    expect(s).not.toContain('user.timeout_until');
    expect(s.indexOf('isBase44EntityId(normalizedSquadId)')).toBeLessThan(s.indexOf('entities.Squad.get(normalizedSquadId)'));
  });
});
