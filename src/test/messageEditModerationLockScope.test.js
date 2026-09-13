import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('message edit moderation lock scope', () => {
  it('runs edit moderation inside the shared message lock', async () => {
    const source = await readFile('base44/functions/mutateConversationMessage/entry.ts', 'utf8');
    const moderation = source.indexOf('const moderation = await moderateEditedText(');
    const lock = source.indexOf('const lockId = await acquireMessageMutationLock(entities, messageId)');
    expect(moderation).toBeGreaterThan(-1);
    expect(lock).toBeGreaterThan(-1);
    expect(moderation).toBeGreaterThan(lock);
  });

  it('keeps the final sender check inside the lock before update', async () => {
    const source = await readFile('base44/functions/mutateConversationMessage/entry.ts', 'utf8');
    const lock = source.indexOf('const lockId = await acquireMessageMutationLock(entities, messageId)');
    const senderCheck = source.indexOf("if (message.sender_id !== user.id)", lock);
    const update = source.indexOf('entities.Message.update(message.id', senderCheck);
    expect(senderCheck).toBeGreaterThan(lock);
    expect(update).toBeGreaterThan(senderCheck);
  });
});
