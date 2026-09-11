// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('message mutation serialization', () => {
  it('serializes edit/react/delete operations per message', async () => {
    const helper = await readText('base44/shared/messageMutationLock.ts');
    expect(helper).toContain('MESSAGE_MUTATION_LOCK_TTL_MS = 2 * 60 * 1000');
    expect(helper).toContain('MessageMutationLock.create');
    expect(helper).toContain('MessageMutationLock.delete');

    const source = await readText('base44/functions/mutateConversationMessage/entry.ts');
    expect(source).toContain("req.method !== 'POST'");
    expect(source).toContain('acquireMessageMutationLock');
    expect(source).toContain('releaseMessageMutationLock');
    expect(source).toContain('messageId.length > 200');
    expect(source).toContain('status: 409');
    expect(source).toContain('emoji.length > 32');
    expect(source).toContain('text.length > 20000');
  });
});
