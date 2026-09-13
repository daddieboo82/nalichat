// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('message reaction concurrency', () => {
  it('serializes read-modify-write reaction updates', async () => {
    const source = await readText('base44/functions/mutateConversationMessage/entry.ts');

    expect(source).toContain('const lockId = await acquireMessageMutationLock(entities, messageId);');
    expect(source).toContain('The outer message lock already serializes reactions for this message.');
    expect(source).toContain("action: 'react'");
    expect(source).toContain('userId: user.id');
    expect(source).toContain('messageId: message.id');
    expect(source).toContain('const message = await entities.Message.get(messageId);');
    expect(source).toContain('const reactions = { ...(message.reactions || {}) };');
    expect(source).toContain('await releaseMessageMutationLock(entities, lockId);');
  });
});
