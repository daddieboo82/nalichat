// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('client-keyed message send serialization', () => {
  it('serializes client-keyed moderation and creation replay checks', async () => {
    const source = await readText('base44/functions/sendConversationMessage/entry.ts');

    const lock = source.indexOf('clientSendLockId = await acquireMessageMutationLock');
    const existingAfterLock = source.indexOf('const existingAfterLock = await findExistingMessage', lock);
    const moderationLock = source.indexOf('moderationLockId = await acquireMessageMutationLock');
    const moderatedReplay = source.indexOf('const existingAfterModerationLock = await findExistingMessage', moderationLock);

    expect(lock).toBeGreaterThan(-1);
    expect(existingAfterLock).toBeGreaterThan(lock);
    expect(moderationLock).toBeGreaterThan(-1);
    expect(moderatedReplay).toBeGreaterThan(moderationLock);
    expect(source).toContain('Message send is already in progress. Please retry.');
    expect(source).toContain('releaseMessageMutationLock(base44.asServiceRole.entities, clientSendLockId)');
  });
});
