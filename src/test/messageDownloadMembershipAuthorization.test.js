import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('message download membership authorization', () => {
  it('authorizes against current conversation membership under the membership lock', async () => {
    const s = await readFile('base44/functions/authorizeMessageDownload/entry.ts', 'utf8');
    const preview = s.indexOf('const messagePreview = await entities.Message.get(messageId)');
    const lock = s.indexOf('const conversationLockId = await acquireConversationMembershipLock');
    const conversation = s.indexOf('entities.Conversation.get(messagePreview.conversation_id)', lock);
    const participant = s.indexOf('participantIds.includes(user.id)', conversation);

    expect(preview).toBeGreaterThan(-1);
    expect(lock).toBeGreaterThan(preview);
    expect(conversation).toBeGreaterThan(lock);
    expect(participant).toBeGreaterThan(conversation);
    expect(s).toContain('Message conversation changed. Please retry.');
    expect(s).toContain('releaseConversationMembershipLock(entities, conversationLockId)');
    expect(s).not.toContain('message.participant_ids.includes(user.id)');
  });

  it('binds download confirmation to the current user, message, and conversation', async () => {
    const backend = await readFile('base44/functions/authorizeMessageDownload/entry.ts', 'utf8');
    expect(backend).toContain("action: 'authorize_message_download'");
    expect(backend).toContain('userId: user.id');
    expect(backend).toContain('messageId: message.id');
    expect(backend).toContain('conversationId: conversation.id');
  });
});
