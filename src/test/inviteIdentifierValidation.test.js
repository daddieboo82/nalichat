import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('invite identifier validation', () => {
  it('validates project ids before project invite lookup', async () => {
    const source = await readFile('base44/functions/acceptProjectInvite/entry.ts', 'utf8');
    expect(source).toContain('isBase44EntityId(projectId.trim())');
    expect(source.indexOf('isBase44EntityId(projectId.trim())')).toBeLessThan(source.indexOf('ProjectInvite.filter('));
  });

  it('requires canonical 24-hex squad invite codes before lookup', async () => {
    const source = await readFile('base44/functions/joinSquad/entry.ts', 'utf8');
    expect(source).toContain('/^[0-9A-F]{24}$/');
    expect(source).toContain('normalizedInviteCode');
    expect(source.indexOf('normalizedInviteCode')).toBeLessThan(source.indexOf('entities.Squad.filter('));
  });
});
