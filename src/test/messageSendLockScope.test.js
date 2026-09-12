import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('message send idempotency lock scope', () => {
  it('does moderation and attachment verification before acquiring the client send lock', async () => {
    const s = await readFile('base44/functions/sendConversationMessage/entry.ts', 'utf8');
    const moderation = s.indexOf('const moderation = await moderateText');
    const media = s.indexOf('const storedSize = await resolveStoredFileSize(fileUrl)');
    const lock = s.indexOf('clientSendLockId = await acquireMessageMutationLock');
    expect(moderation).toBeGreaterThan(-1);
    expect(media).toBeGreaterThan(-1);
    expect(lock).toBeGreaterThan(moderation);
    expect(lock).toBeGreaterThan(media);
  });
  it('rechecks duplicate and moderation replay state after lock acquisition', async () => {
    const s = await readFile('base44/functions/sendConversationMessage/entry.ts', 'utf8');
    const lock = s.indexOf('clientSendLockId = await acquireMessageMutationLock');
    expect(s.indexOf('existingAfterLock', lock)).toBeGreaterThan(lock);
    expect(s.indexOf('moderationAfterLock', lock)).toBeGreaterThan(lock);
  });
});
