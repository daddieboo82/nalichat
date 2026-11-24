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
  it('rejects longer stale snapshots that lose completed replies', () => {
    const staleLonger = [earlier[0], { id: 'a1', role: 'assistant', content: 'Partial', status: 'generating' }, { id: 'u2', role: 'user', content: 'New question' }];
    expect(preferCurrentConversationMessages(newer, staleLonger)).toEqual(newer);
    const finishedLonger = [earlier[0], { id: 'a1', role: 'assistant', content: 'Updated complete answer', status: 'completed' }, { id: 'u2', role: 'user', content: 'New question' }];
    expect(preferCurrentConversationMessages(newer, finishedLonger)).toEqual(finishedLonger);
  });
  it('rejects longer snapshots from conflicting conversation histories', () => {
    const conflicting = [{ id: 'other-u1', role: 'user', content: 'Different user question' }, newer[1], { id: 'u3', role: 'user', content: 'Extra message' }];
    expect(preferCurrentConversationMessages(newer, conflicting)).toEqual(newer);
    const valid = [...newer, { id: 'u3', role: 'user', content: 'Extra message' }];
    expect(preferCurrentConversationMessages(newer, valid)).toEqual(valid);
  });
  it('keeps the longer same-ID streaming text when an older partial update arrives', () => {
    const live = [...earlier, { id: 'a1', role: 'assistant', status: 'streaming', content: 'Here is the first verse' }];
    const older = [...earlier, { id: 'a1', role: 'assistant', status: 'streaming', content: 'Here is the' }];
    expect(preferCurrentConversationMessages(live, older)).toEqual(live);
    expect(preferCurrentConversationMessages(live, [...older, { id: 'u2', role: 'user', content: 'Extra event' }])).toEqual(live);
    expect(preferCurrentConversationMessages(older, live)).toEqual(live);
  });
  it('still accepts the final completed reply even if it edits the streamed text', () => {
    const live = [...earlier, { id: 'a1', role: 'assistant', status: 'streaming', content: 'Here is the first verse draft' }];
    const finalReply = [...earlier, { id: 'a1', role: 'assistant', status: 'completed', content: 'Here is a verse' }];
    expect(preferCurrentConversationMessages(live, finalReply)).toEqual(finalReply);
  });
  it('rejects a same-ID snapshot that changes a message sender role', () => {
    const conflicting = [earlier[0], { id: 'a1', role: 'user', content: 'Not an assistant reply' }];
    expect(preferCurrentConversationMessages(newer, conflicting)).toEqual(newer);
    expect(preferCurrentConversationMessages(newer, [...conflicting, { id: 'u3', role: 'user', content: 'Extra' }])).toEqual(newer);
  });
  it('preserves completed same-ID replies even if the total completion count stays constant', () => {
    const current = [earlier[0], { id: 'a1', role: 'assistant', content: 'Already complete', status: 'completed' }, { id: 'u2', role: 'user', content: 'Next question' }, { id: 'a2', role: 'assistant', content: 'Partial next', status: 'streaming' }];
    const stale = [earlier[0], { id: 'a1', role: 'assistant', content: 'Earlier partial', status: 'streaming' }, current[2], { id: 'a2', role: 'assistant', content: 'Finished next', status: 'completed' }];
    expect(preferCurrentConversationMessages(current, stale)).toEqual(current);
    const valid = [current[0], current[1], current[2], { id: 'a2', role: 'assistant', content: 'Finished next', status: 'completed' }];
    expect(preferCurrentConversationMessages(current, valid)).toEqual(valid);
  });
  it('protects realtime subscriptions and both manual and timed refresh paths', async () => {
    const code = await readFile('src/components/AiAssistant.jsx', 'utf8');
    expect(code).toContain('preferCurrentConversationMessages(messagesRef.current, data.messages)');
    expect(code).toContain('preferCurrentConversationMessages(messagesRef.current, fresh?.messages)');
    expect(code).toContain('void refreshPendingReply({ quiet: true });');
  });
});
