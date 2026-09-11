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
    expect(source).toContain('threadId.length > 200');
    expect(source.indexOf('acquireMessageMutationLock')).toBeLessThan(
      source.indexOf('Message.get(threadId)'),
    );
    expect(source.indexOf('Message.get(threadId)')).toBeLessThan(
      source.indexOf('Message.create({'),
    );
  });
});
