import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('message read receipt serialization', () => {
  it('rechecks the message under the conversation lock and verifies the atomic update', async () => {
    const s = await readFile('base44/functions/markMessageRead/entry.ts', 'utf8');
    const lock = s.indexOf('const conversationLockId = await acquireConversationMembershipLock');
    const recheck = s.indexOf('const currentMessage = await entities.Message.get(messageId)', lock);
    const changed = s.indexOf('Message conversation changed. Please retry.', recheck);
    const update = s.indexOf('const readUpdate = await entities.Message.updateMany', changed);

    expect(lock).toBeGreaterThan(-1);
    expect(recheck).toBeGreaterThan(lock);
    expect(changed).toBeGreaterThan(recheck);
    expect(update).toBeGreaterThan(changed);
    expect(s).toContain('Number(readUpdate?.updated || 0) !== 1');
    expect(s).toContain("conversation_id: message.conversation_id");
  });
});
