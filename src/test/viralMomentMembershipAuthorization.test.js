import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Viral Moment current membership authorization', () => {
  it('checks voice entitlement before storage probes and current conversation membership before metered AI', async () => {
    const s = await readFile('base44/functions/generate-viral-moment/entry.ts', 'utf8');
    const voiceEntitlement = s.indexOf("'voice.transcription'");
    const probe = s.indexOf('const mediaSize = await storedMediaSize(messagePreview.file_url)');
    const lock = s.indexOf('const conversationLockId = await acquireConversationMembershipLock');
    const conversation = s.indexOf('entities.Conversation.get(messagePreview.conversation_id)', lock);
    const participant = s.indexOf('currentParticipantIds.includes(user.id)', conversation);
    const metered = s.indexOf('const { result, quota } = await executeMeteredAiRequest', participant);

    expect(voiceEntitlement).toBeGreaterThan(-1);
    expect(probe).toBeGreaterThan(voiceEntitlement);
    expect(lock).toBeGreaterThan(probe);
    expect(conversation).toBeGreaterThan(lock);
    expect(participant).toBeGreaterThan(conversation);
    expect(metered).toBeGreaterThan(participant);
    expect(s).toContain('Message content changed. Please retry.');
    expect(s).toContain('releaseConversationMembershipLock(entities, conversationLockId)');
    expect(s).not.toContain('message.participant_ids.includes(user.id)');
  });
});
