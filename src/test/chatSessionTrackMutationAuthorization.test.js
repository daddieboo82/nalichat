import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('chat-session track mutation authorization', () => {
  it('uses current Conversation membership for session-track update/delete', async () => {
    const s = await readFile('base44/functions/mutateTrack/entry.ts', 'utf8');
    const conversationLock = s.indexOf('const conversationLockId = sessionConversationId');
    const trackLock = s.indexOf('const lockId = await acquireTrackLifecycleLock', conversationLock);
    const recheckMessage = s.indexOf('entities.Message.get(track.project_id)', trackLock);
    const recheckConversation = s.indexOf('entities.Conversation.get(sessionConversationId)', trackLock);
    const currentMembership = s.indexOf('participantIds.includes(user.id)', recheckConversation);

    expect(conversationLock).toBeGreaterThan(-1);
    expect(trackLock).toBeGreaterThan(conversationLock);
    expect(recheckMessage).toBeGreaterThan(trackLock);
    expect(recheckConversation).toBeGreaterThan(trackLock);
    expect(currentMembership).toBeGreaterThan(recheckConversation);
    expect(s).toContain('Session conversation changed. Please retry.');
    expect(s).toContain('releaseConversationMembershipLock(entities, conversationLockId)');
    expect(s).not.toContain('sessionMessage?.participant_ids');
  });
});
