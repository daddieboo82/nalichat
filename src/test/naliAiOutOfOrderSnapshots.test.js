// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { hasReplySince, preferCurrentConversationMessages } from '@/lib/naliReplyStatus';

const earlier = [{ id: 'u1', role: 'user', content: 'First question' }];
const newer = [...earlier, { id: 'a1', role: 'assistant', content: 'First answer' }];

describe('NALI.ai out-of-order conversation snapshots', () => {
  it('keeps a newer realtime reply when a delayed history fetch finishes later', () => {
    expect(preferCurrentConversationMessages(newer, earlier)).toEqual(newer);
    expect(hasReplySince(preferCurrentConversationMessages(newer, earlier), 0)).toBe(true);
  });
  it('accepts genuinely newer messages and same-length streaming updates', () => {
    expect(preferCurrentConversationMessages(earlier, newer)).toEqual(newer);
    const updated = [...earlier, { id: 'a1', role: 'assistant', content: 'Updated answer' }];
    expect(preferCurrentConversationMessages(newer, updated)).toEqual(updated);
  });
  it('rejects equal-length snapshots with conflicting message identities', () => {
    const conflicting = [...earlier, { id: 'a-old', role: 'assistant', content: 'Earlier response' }];
    expect(preferCurrentConversationMessages(newer, conflicting)).toEqual(newer);
    const sameIdentityEdit = [...earlier, { id: 'a1', role: 'assistant', content: 'Updated response' }];
    expect(preferCurrentConversationMessages(newer, sameIdentityEdit)).toEqual(sameIdentityEdit);
    const conflictingUser = [{ id: 'different-user-id', role: 'user', content: 'Another thread' }, newer[1]];
    expect(preferCurrentConversationMessages(newer, conflictingUser)).toEqual(newer);
  });
  it('does not replace an assistant reply with an equal-length stale user snapshot', () => {
    const stale = [...earlier, { id: 'u2', role: 'user', content: 'Still waiting' }];
    expect(preferCurrentConversationMessages(newer, stale)).toEqual(newer);
    expect(preferCurrentConversationMessages(newer, undefined)).toEqual(newer);
  });
  it('protects realtime subscriptions and both manual and timed refresh paths', async () => {
    const code = await readFile('src/components/AiAssistant.jsx', 'utf8');
    expect(code).toContain('preferCurrentConversationMessages(messagesRef.current, data.messages)');
    expect(code).toContain('preferCurrentConversationMessages(messagesRef.current, fresh?.messages)');
    expect(code).toContain('void refreshPendingReply({ quiet: true });');
  });
});
