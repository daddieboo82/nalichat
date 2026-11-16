import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

// Service-role bulk updates to User are forbidden, so the generated-count and
// first-use XP land on the verified account only.
describe('ViralSeed XP update integrity', () => {
  it('requires the verified account to receive generated-count and first-use XP updates', async () => {
    const s = await readFile('base44/functions/generateViralConcepts/entry.ts', 'utf8');
    expect(s).toContain('const currentUser = await entities.User.get(user.id)');
    expect(s).toContain('if (!currentUser || currentUser.id !== user.id)');
    expect(s).toContain('await entities.User.update(user.id,');
    expect(s).not.toContain('entities.User.updateMany');
    expect(s).toContain('entities.Achievement.delete(achievementId)');
  });
});