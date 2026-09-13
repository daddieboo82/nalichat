import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('chat-session collaborative track authorization', () => {
  it('authorizes from current Conversation membership under the membership lock', async () => {
    const s = await readFile('base44/functions/createCollaborativeTrack/entry.ts', 'utf8');
    const previewMessage = s.indexOf('const messagePreview = await entities.Message.get(projectId)');
    const previewConversation = s.indexOf('const conversationPreview = await entities.Conversation', previewMessage);
    const lock = s.indexOf('await acquireConversationMembershipLock(entities, sessionConversationId)', previewConversation);
    const recheckMessage = s.indexOf('entities.Message.get(projectId)', lock);
    const recheckConversation = s.indexOf('entities.Conversation.get(sessionConversationId)', lock);
    const participant = s.indexOf('participantIds.includes(user.id)', recheckConversation);
    const create = s.indexOf('const track = await entities.Track.create({', participant);

    expect(previewMessage).toBeGreaterThan(-1);
    expect(previewConversation).toBeGreaterThan(previewMessage);
    expect(lock).toBeGreaterThan(previewConversation);
    expect(recheckMessage).toBeGreaterThan(lock);
    expect(recheckConversation).toBeGreaterThan(lock);
    expect(participant).toBeGreaterThan(recheckConversation);
    expect(create).toBeGreaterThan(participant);
    expect(s).toContain('Session conversation changed. Please retry.');
    expect(s).toContain('releaseConversationMembershipLock(entities, conversationLockId)');
    expect(s).not.toContain('message?.participant_ids?.includes(user.id)');
  });
});
