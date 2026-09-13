import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('message moderation retry serialization', () => {
  it('serializes replay checks and moderation for one client message key', async () => {
    const s = await readFile('base44/functions/sendConversationMessage/entry.ts', 'utf8');
    const moderationBlock = s.indexOf("if (text.trim() && !user.is_banned)");
    const lock = s.indexOf('moderationLockId = await acquireMessageMutationLock', moderationBlock);
    const replay = s.indexOf('const moderationReplay = await findModerationReplay', lock);
    const moderate = s.indexOf('const moderation = await moderateText', replay);
    const release = s.indexOf('releaseMessageMutationLock(', moderate);

    expect(moderationBlock).toBeGreaterThan(-1);
    expect(lock).toBeGreaterThan(moderationBlock);
    expect(replay).toBeGreaterThan(lock);
    expect(moderate).toBeGreaterThan(replay);
    expect(release).toBeGreaterThan(moderate);
    expect(s).toContain('Message moderation is already in progress. Please retry.');
  });
});
