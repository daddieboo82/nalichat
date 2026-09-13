import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('message report membership authorization', () => {
  it('uses current Conversation membership and lock ordering for message reports', async () => {
    const s = await readFile('base44/functions/reportContent/entry.ts', 'utf8');
    const previewConversation = s.indexOf('const conversationPreview = await entities.Conversation');
    const conversationLock = s.indexOf('acquireConversationMembershipLock(entities, messageConversationId)', previewConversation);
    const messageLock = s.indexOf('acquireMessageMutationLock(entities, normalizedContentId)', conversationLock);
    const recheckConversation = s.indexOf('entities.Conversation.get(messageConversationId)', messageLock);
    const membership = s.indexOf('participantIds.includes(reporter.id)', recheckConversation);

    expect(previewConversation).toBeGreaterThan(-1);
    expect(conversationLock).toBeGreaterThan(previewConversation);
    expect(messageLock).toBeGreaterThan(conversationLock);
    expect(recheckConversation).toBeGreaterThan(messageLock);
    expect(membership).toBeGreaterThan(recheckConversation);
    expect(s).toContain('Message conversation changed. Please retry.');
    expect(s).toContain('releaseConversationMembershipLock(entities, conversationLockId)');
    expect(s).not.toContain('preview.participant_ids.includes(reporter.id)');
    expect(s).not.toContain('message.participant_ids.includes(reporter.id)');
  });
});
