// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const getSource = () => readFile('src/components/AiAssistant.jsx', 'utf8');

describe('NALI.ai unified messaging and safe refresh', () => {
  it('shares the same guarded sender between typed messages and app-triggered messages', async () => {
    const source = await getSource();
    expect(source).toContain('await sendText(text, { preserveDraft: true });');
    expect(source).toContain('if (!text?.trim() || sendInFlightRef.current) return;');
    expect(source).toContain('if (!preserveDraft) setInput("");');
    expect(source).toContain('if (!preserveDraft) setInput(current => current || text);');
    expect(source).toContain('if (greeting) await sendText(greeting, { preserveDraft: true });');
  });

  it('reuses an initialized conversation before React has rerendered', async () => {
    const source = await getSource();
    expect(source).toContain('const conversationRef = useRef(null);');
    expect(source).toContain('conversationRef.current = conv;');
    expect(source).toContain('if (conversationRef.current) return conversationRef.current;');
    expect(source).toContain('conversationRef.current = null;');
  });

  it('refreshes pending results without resending a request or charging another AI quota unit', async () => {
    const source = await getSource();
    const start = source.indexOf('const refreshPendingReply = async () => {');
    const end = source.indexOf('const send = () => sendText(input);', start);
    const refresh = source.slice(start, end);
    expect(refresh).toContain('base44.agents.getConversation(conversation.id)');
    expect(refresh).not.toContain('sendAgentText(');
    expect(refresh).not.toContain('sendText(');
    expect(source).toContain('Check reply</button>');
  });
});