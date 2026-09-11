// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('thread reply deletion retryability', () => {
  it('serializes parent count updates and restores the count if delete fails', async () => {
    const source = await readText('base44/functions/mutateConversationMessage/entry.ts');

    expect(source).toContain('parentThreadLockId');
    expect(source).toContain('acquireMessageMutationLock(entities, message.thread_id)');
    expect(source).toContain("Unable to update parent thread reply count");
    expect(source).toContain('Number(replyCountUpdate?.updated || 0) !== 1');
    expect(source).toContain('$inc: { thread_reply_count: 1 }');
    expect(source).toContain('releaseMessageMutationLock(entities, parentThreadLockId)');
  });
});
