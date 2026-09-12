import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('send message lock authorization ordering', () => {
  it('checks conversation membership before idempotency lock acquisition', async () => {
    const source = await readFile('base44/functions/sendConversationMessage/entry.ts', 'utf8');
    const conversation = source.indexOf('const conversation = await base44.asServiceRole.entities.Conversation.get(conversationId)');
    const participant = source.indexOf('conversation.participant_ids.includes(user.id)');
    const lock = source.indexOf('clientSendLockId = await acquireMessageMutationLock');
    expect(conversation).toBeGreaterThan(-1);
    expect(participant).toBeGreaterThan(conversation);
    expect(participant).toBeLessThan(lock);
  });

  it('validates the thread target before acquiring its message lock', async () => {
    const source = await readFile('base44/functions/sendConversationMessage/entry.ts', 'utf8');
    const preview = source.indexOf('const threadPreview = await base44.asServiceRole.entities.Message.get(threadId)');
    const lock = source.indexOf('threadLockId = await acquireMessageMutationLock');
    expect(source).toContain('isBase44EntityId(threadId)');
    expect(preview).toBeGreaterThan(-1);
    expect(preview).toBeLessThan(lock);
  });
});
