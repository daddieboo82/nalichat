import { describe, expect, it } from 'vitest';
import { reconcilePendingConversations, PENDING_CONVERSATION_MAX_AGE_MS } from '../lib/pendingConversationReconciliation';

const dm = { id: 'dm-new', type: 'dm', participant_ids: ['viewer', 'friend'] };
const entry = (createdAt = 1000) => new Map([['dm-new', { conversation: dm, userId: 'viewer', createdAt }]]);

describe('new DM propagation reconciliation', () => {
  it('retains a confirmed new DM while the member query temporarily omits it', () => {
    const pending = entry();
    expect(reconcilePendingConversations([], pending, 'viewer', 2000)).toEqual([dm]);
    expect(pending.size).toBe(1);
  });

  it('uses the authoritative row once the member query returns it without duplicates', () => {
    const pending = entry();
    const fromServer = { ...dm, name: 'updated' };
    expect(reconcilePendingConversations([fromServer], pending, 'viewer', 2000)).toEqual([fromServer]);
    expect(pending.size).toBe(0);
  });

  it('expires pending DMs and never shows another account or an unrelated group', () => {
    const expired = entry();
    expect(reconcilePendingConversations([], expired, 'viewer', 1000 + PENDING_CONVERSATION_MAX_AGE_MS)).toEqual([]);
    expect(expired.size).toBe(0);
    const another = entry();
    expect(reconcilePendingConversations([], another, 'different', 2000)).toEqual([]);
    expect(another.size).toBe(0);
    const group = new Map([['group', { userId: 'viewer', createdAt: 1000, conversation: { id: 'group', type: 'group', participant_ids: ['viewer'] } }]]);
    expect(reconcilePendingConversations([], group, 'viewer', 2000)).toEqual([]);
  });
});
