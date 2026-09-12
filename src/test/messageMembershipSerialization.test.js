import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('message membership serialization', () => {
  it('sends with conversation lock before message/thread locks', async () => {
    const s = await readFile('base44/functions/sendConversationMessage/entry.ts', 'utf8');
    const conversationLock = s.indexOf('const conversationLockId = await acquireConversationMembershipLock');
    const clientLock = s.indexOf('clientSendLockId = await acquireMessageMutationLock');
    const threadLock = s.indexOf('threadLockId = await acquireMessageMutationLock');
    expect(conversationLock).toBeGreaterThan(-1);
    expect(clientLock).toBeGreaterThan(conversationLock);
    expect(threadLock).toBeGreaterThan(conversationLock);
    expect(s.indexOf('lockedParticipantIds.includes(user.id)', conversationLock)).toBeGreaterThan(conversationLock);
  });

  it('mutates messages with conversation lock before message locks', async () => {
    const s = await readFile('base44/functions/mutateConversationMessage/entry.ts', 'utf8');
    const conversationLock = s.indexOf('const conversationLockId = await acquireConversationMembershipLock', s.indexOf('let editedText'));
    const messageLock = s.indexOf('const lockId = await acquireMessageMutationLock', conversationLock);
    expect(conversationLock).toBeGreaterThan(-1);
    expect(messageLock).toBeGreaterThan(conversationLock);
    expect(s.indexOf('participantIds.includes(user.id)', conversationLock)).toBeGreaterThan(conversationLock);
    expect(s.indexOf('Message conversation changed. Please retry.', messageLock)).toBeGreaterThan(messageLock);
  });

  it('serializes typing status with conversation membership', async () => {
    const s = await readFile('base44/functions/updateTypingStatus/entry.ts', 'utf8');
    expect(s).toContain('acquireConversationMembershipLock(entities, conversationId)');
    expect(s).toContain('releaseConversationMembershipLock(entities, conversationLockId)');
  });

  it('authorizes read receipts against current conversation membership', async () => {
    const s = await readFile('base44/functions/markMessageRead/entry.ts', 'utf8');
    const lock = s.indexOf('acquireConversationMembershipLock(entities, message.conversation_id)');
    const membership = s.indexOf('participantIds.includes(user.id)', lock);
    const update = s.indexOf('entities.Message.updateMany', membership);
    expect(lock).toBeGreaterThan(-1);
    expect(membership).toBeGreaterThan(lock);
    expect(update).toBeGreaterThan(membership);
  });
});
