import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('account deletion conversation locking', () => {
  it('serializes membership removal with message and membership mutations', async () => {
    const s = await readFile('base44/functions/deleteMyAccount/entry.ts', 'utf8');
    expect(s).toContain('acquireConversationMembershipLock');
    expect(s).toContain('releaseConversationMembershipLock');
    expect(s).toContain('async function withConversationMembershipLock(');

    const scan = s.indexOf("{ participant_ids: user.id }");
    const lock = s.indexOf('withConversationMembershipLock(', scan);
    const recheck = s.indexOf('entities.Conversation.get(conversation.id)', lock);
    const update = s.indexOf('entities.Conversation.update(currentConversation.id', recheck);
    const sync = s.indexOf('await syncConversationAudience(', update);

    expect(scan).toBeGreaterThan(-1);
    expect(lock).toBeGreaterThan(scan);
    expect(recheck).toBeGreaterThan(lock);
    expect(update).toBeGreaterThan(recheck);
    expect(sync).toBeGreaterThan(update);
  });
});
