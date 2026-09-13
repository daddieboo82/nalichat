import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('deleted conversation data cleanup', () => {
  it('resolves reminders and clears conversation-scoped private records before parent deletion', async () => {
    const s = await readFile('base44/functions/manageConversation/entry.ts', 'utf8');
    expect(s).toContain('async function cleanupDeletedConversationData');
    expect(s).toContain("resolution_reason: 'conversation_deleted'");
    expect(s).toContain('entities.LockedConversationPreference');
    expect(s).toContain('entities.Notification');
    expect(s).toContain("status: 'deleted'");
    expect(s).toContain("audio_url: ''");
    expect(s).toContain("transcript: ''");
    expect(s).toContain("summary: ''");
    expect(s).toContain("failure_code: 'CONVERSATION_DELETED'");

    const cleanup = s.indexOf('await cleanupDeletedConversationData(entities, conversation.id)');
    const parentDelete = s.indexOf('await entities.Conversation.delete(conversation.id)', cleanup);
    expect(cleanup).toBeGreaterThan(-1);
    expect(parentDelete).toBeGreaterThan(cleanup);
  });
});
