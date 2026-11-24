// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const read = () => readFile('src/components/AiAssistant.jsx', 'utf8');

describe('NALI.ai hidden reply narration', () => {
  it('marks assistant replies received in the background as already spoken', async () => {
    const source = await read();
    const start = source.indexOf('const suppressBackgroundNarration = (incomingMessages) => {');
    const end = source.indexOf('const staleIdentityError', start);
    const helper = source.slice(start, end);
    expect(helper).toContain("if (document.visibilityState !== 'hidden') return;");
    expect(helper).toContain("if (message?.role !== 'assistant') continue;");
    expect(helper).toContain('message.id || message.content?.substring(0, 160)');
    expect(helper).toContain('spokenIdsRef.current.add(id);');
  });
  it('guards realtime events, history refreshes, and background transitions', async () => {
    const source = await read();
    expect(source).toContain('suppressBackgroundNarration(messagesRef.current);');
    expect(source).toContain('suppressBackgroundNarration(msgs);\n      messagesRef.current = msgs;');
    expect(source).toContain('suppressBackgroundNarration(received);\n      messagesRef.current = received;');
    expect(source).toContain('if (!id || spokenIdsRef.current.has(id)) return;');
  });
  it('does not clear pending AI requests or resend any prompt during background handling', async () => {
    const source = await read();
    const start = source.indexOf('const suppressBackgroundNarration = (incomingMessages) => {');
    const end = source.indexOf('const staleIdentityError', start);
    const helper = source.slice(start, end);
    expect(helper).not.toContain('sendAgentText(');
    expect(helper).not.toContain('sendInFlightRef.current = false');
  });
});
