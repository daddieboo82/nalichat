import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('account deletion milestone anonymization', () => {
  it('tombstones milestone creator/completer identities in retained shared projects', async () => {
    const s = await readFile('base44/functions/deleteMyAccount/entry.ts', 'utf8');
    const creatorMatches = s.match(/row\.created_by_id === user\.id/g) || [];
    const completerMatches = s.match(/row\.completed_by_id === user\.id/g) || [];
    expect(creatorMatches.length).toBeGreaterThanOrEqual(2);
    expect(completerMatches.length).toBeGreaterThanOrEqual(2);
    expect(s).toContain('update.created_by_id = tombstoneId');
    expect(s).toContain('update.completed_by_id = tombstoneId');
  });
});
