// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { countAssistantReplies, hasReplySince } from '@/lib/naliReplyStatus';

const history = [
  { role: 'user', content: 'Old question' },
  { role: 'assistant', content: 'Old answer' },
];

describe('NALI.ai pending reply completion', () => {
  it('does not treat an existing assistant reply as the response to a new request', () => {
    const baseline = countAssistantReplies(history);
    expect(baseline).toBe(1);
    expect(hasReplySince(history, baseline)).toBe(false);
    expect(hasReplySince([...history, { role: 'user', content: 'New question' }], baseline)).toBe(false);
  });
  it('unlocks only after a new assistant answer arrives', () => {
    const baseline = countAssistantReplies(history);
    const messages = [...history, { role: 'user', content: 'New question' }, { role: 'assistant', content: 'New answer' }];
    expect(hasReplySince(messages, baseline)).toBe(true);
    expect(hasReplySince(messages, null)).toBe(false);
    expect(hasReplySince(undefined, baseline)).toBe(false);
  });
  it('sets a baseline after restoring history and clears it on identity changes and failures', async () => {
    const code = await readFile('src/components/AiAssistant.jsx', 'utf8');
    expect(code.indexOf('if (!conv) conv = await initConversation();')).toBeLessThan(code.indexOf('pendingAssistantBaselineRef.current = countAssistantReplies(messagesRef.current);'));
    expect(code).toContain('if (sendInFlightRef.current && hasReplySince(msgs, pendingAssistantBaselineRef.current))');
    expect(code).toContain('void refreshPendingReply({ quiet: true });');
    expect(code).toContain('if (hasReplySince(received, pendingAssistantBaselineRef.current))');
    expect(code).toContain('pendingAssistantBaselineRef.current = null;');
    expect(code).toContain('if (!sendInFlightRef.current) return;');
  });
});
