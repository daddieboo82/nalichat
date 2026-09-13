// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('thread reply serialization', () => {
  it('locks the parent message across validation, reply create, and reply-count update', async () => {
    const source = await readText('base44/functions/sendConversationMessage/entry.ts');

    expect(source).toContain('acquireMessageMutationLock');
    expect(source).toContain('releaseMessageMutationLock');
    expect(source).toContain('threadLockId');
    expect(source).toContain("error: 'Thread is being updated. Please retry.'");
    expect(source).toContain('if (!isBase44EntityId(threadId))');
    const preview = source.indexOf('Message.get(threadId).catch(() => null)');
    const lock = source.indexOf('threadLockId = await acquireMessageMutationLock', preview);
    const revalidate = source.indexOf('Message.get(threadId).catch(() => null)', lock);
    const create = source.indexOf('Message.create({', revalidate);
    expect(preview).toBeGreaterThan(-1);
    expect(lock).toBeGreaterThan(preview);
    expect(revalidate).toBeGreaterThan(lock);
    expect(create).toBeGreaterThan(revalidate);
  });
});
