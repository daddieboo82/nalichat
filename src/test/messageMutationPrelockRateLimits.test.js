import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('message mutation pre-lock throttling', () => {
  it('rate-limits react, edit, and delete before the shared message lock', async () => {
    const source = await readFile('base44/functions/mutateConversationMessage/entry.ts', 'utf8');
    const lock = source.indexOf('const lockId = await acquireMessageMutationLock(entities, messageId)');
    for (const marker of ["'message_reaction'", "'message_edit'", "'message_delete'"]) {
      const index = source.indexOf(marker);
      expect(index).toBeGreaterThan(-1);
      expect(index).toBeLessThan(lock);
    }
  });
});
