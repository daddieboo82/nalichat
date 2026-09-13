import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('message mutation lock safety', () => {
  it('authorizes the caller before acquiring the message mutation lock', async () => {
    const source = await readFile('base44/functions/mutateConversationMessage/entry.ts', 'utf8');
    const preview = source.indexOf('const messagePreview = await entities.Message.get(messageId)');
    const participantCheck = source.indexOf('if (!conversation || !participantIds.includes(user.id))');
    const lock = source.indexOf('const lockId = await acquireMessageMutationLock(entities, messageId)');
    expect(preview).toBeGreaterThan(-1);
    expect(participantCheck).toBeGreaterThan(preview);
    expect(participantCheck).toBeLessThan(lock);
  });

  it('does not reacquire the same message lock for reactions', async () => {
    const source = await readFile('base44/functions/mutateConversationMessage/entry.ts', 'utf8');
    expect(source).toContain('The outer message lock already serializes reactions');
    expect(source).not.toContain('acquireMessageMutationLock(entities, message.id)');
    expect(source).not.toContain('releaseMessageMutationLock(entities, reactionLockId)');
  });
});
