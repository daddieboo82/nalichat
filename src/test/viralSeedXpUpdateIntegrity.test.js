import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('ViralSeed XP update integrity', () => {
  it('requires exactly one user row to receive generated-count and first-use XP updates', async () => {
    const s = await readFile('base44/functions/generateViralConcepts/entry.ts', 'utf8');
    expect(s).toContain('const userUpdate = await entities.User.updateMany');
    expect(s).toContain('Number(userUpdate?.updated || 0) !== 1');
    expect(s).toContain('entities.Achievement.delete(achievementId)');
  });
});
