// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { countAssistantReplies, hasReplySince, isUsableAssistantReply, preferCurrentConversationMessages } from '@/lib/naliReplyStatus';

const conversation = [{ id: 'u1', role: 'user', content: 'Write a chorus' }];

describe('NALI.ai waits for a usable assistant reply', () => {
  it('does not unlock for blank placeholders or non-assistant events', () => {
    const baseline = countAssistantReplies(conversation);
    for (const content of ['', '  ', null, undefined, []]) {
      const snapshot = [...conversation, { id: 'a1', role: 'assistant', content }];
      expect(hasReplySince(snapshot, baseline)).toBe(false);
    }
    expect(hasReplySince([...conversation, { role: 'tool', content: 'done' }], baseline)).toBe(false);
  });
  it('does not unlock explicitly streaming or pending assistant responses', () => {
    for (const state of [{ is_streaming: true }, { completed: false }, { status: 'streaming' }, { status: 'pending' }, { status: 'in_progress' }, { status: 'generating' }, { status: 'queued' }, { status: 'processing' }, { status: 'IN_PROGRESS' }]) {
      expect(isUsableAssistantReply({ role: 'assistant', content: 'Partial response', ...state })).toBe(false);
    }
  });
  it('does not treat new partial assistant text as a completed reply', () => {
    const baseline = { assistantCount: 0, messageCount: 1 };
    for (const status of ['in_progress', 'generating', 'queued', 'processing']) {
      expect(hasReplySince([...conversation, { id: 'a1', role: 'assistant', content: 'Partial answer', status }], baseline)).toBe(false);
    }
    expect(hasReplySince([...conversation, { id: 'a1', role: 'assistant', content: 'Completed answer', status: 'completed' }], baseline)).toBe(true);
  });
  it('unlocks for nonempty completed plain text and structured text replies', () => {
    expect(hasReplySince([...conversation, { role: 'assistant', content: 'Here is a chorus' }], 0)).toBe(true);
    expect(isUsableAssistantReply({ role: 'assistant', content: [{ type: 'text', text: 'Done' }] })).toBe(true);
    expect(isUsableAssistantReply({ role: 'assistant', content: [{ type: 'tool_use' }] })).toBe(false);
  });
  it('retains a usable reply instead of an equal-length blank stale snapshot', () => {
    const complete = [...conversation, { id: 'a1', role: 'assistant', content: 'Chorus' }];
    const stale = [...conversation, { id: 'a1', role: 'assistant', content: '' }];
    expect(preferCurrentConversationMessages(complete, stale)).toEqual(complete);
  });
});
