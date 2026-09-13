// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('client-keyed message send serialization', () => {
  it('locks before duplicate checks, rate limits, and moderation', async () => {
    const source = await readText('base44/functions/sendConversationMessage/entry.ts');

    const lock = source.indexOf('clientSendLockId = await acquireMessageMutationLock');
    const existingAfterLock = source.indexOf('const existingAfterLock = await findExistingMessage', lock);
    const rate = source.indexOf("'conversation_message'");
    const moderation = source.indexOf('const moderation = await moderateText');

    expect(lock).toBeGreaterThan(-1);
    expect(existingAfterLock).toBeGreaterThan(lock);
    expect(rate).toBeGreaterThan(lock);
    expect(moderation).toBeGreaterThan(lock);
    expect(source).toContain('Message send is already in progress. Please retry.');
    expect(source).toContain('releaseMessageMutationLock(base44.asServiceRole.entities, clientSendLockId)');
  });
});
