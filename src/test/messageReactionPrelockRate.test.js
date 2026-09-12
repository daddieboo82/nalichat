import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('message reaction pre-lock throttling', () => {
  it('checks reaction rate before acquiring the shared message lock', async () => {
    const source = await readFile('base44/functions/mutateConversationMessage/entry.ts', 'utf8');
    const rate = source.indexOf("'message_reaction'");
    const lock = source.indexOf('const lockId = await acquireMessageMutationLock(entities, messageId)');
    expect(rate).toBeGreaterThan(-1);
    expect(lock).toBeGreaterThan(-1);
    expect(rate).toBeLessThan(lock);
  });
});
