// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('conversation membership serialization', () => {
  it('serializes public joins, leaves, renames, and audience synchronization', async () => {
    const helper = await readText('base44/shared/conversationMembershipLock.ts');
    expect(helper).toContain('CONVERSATION_MEMBERSHIP_LOCK_TTL_MS = 5 * 60 * 1000');
    expect(helper).toContain('ConversationMembershipLock.create');
    expect(helper).toContain('ConversationMembershipLock.delete');

    const source = await readText('base44/functions/manageConversation/entry.ts');
    expect(source).toContain('acquireConversationMembershipLock');
    expect(source).toContain('releaseConversationMembershipLock');
    expect(source).toContain("['join_public', 'leave', 'rename'].includes(action)");
    expect(source).toContain('Conversation membership is being updated. Please retry.');
    expect(source).toContain('const currentRoom = await entities.Conversation.get(room.id)');
    expect(source).toContain('status: 409');
  });
});
