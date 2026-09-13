import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('message transcription authorization', () => {
  it('checks entitlement before media probes and authorizes from current conversation membership', async () => {
    const s = await readFile('base44/functions/transcribeMessageAudio/entry.ts', 'utf8');
    const entitlement = s.indexOf("requireEntitlement(entities, user.id, 'voice.transcription')");
    const probe = s.indexOf('const mediaSize = await storedMediaSize(messagePreview.file_url)');
    const lock = s.indexOf('const conversationLockId = await acquireConversationMembershipLock');
    const conversation = s.indexOf('entities.Conversation.get(messagePreview.conversation_id)', lock);
    const participant = s.indexOf('participantIds.includes(user.id)', conversation);
    const metered = s.indexOf('const { result, quota } = await executeMeteredAiRequest', participant);

    expect(entitlement).toBeGreaterThan(-1);
    expect(probe).toBeGreaterThan(entitlement);
    expect(lock).toBeGreaterThan(probe);
    expect(conversation).toBeGreaterThan(lock);
    expect(participant).toBeGreaterThan(conversation);
    expect(metered).toBeGreaterThan(participant);
    expect(s).toContain('Message audio changed. Please retry.');
    expect(s).toContain('releaseConversationMembershipLock(entities, conversationLockId)');
  });
});
