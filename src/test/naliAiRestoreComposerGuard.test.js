// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const read = () => readFile('src/components/AiAssistant.jsx', 'utf8');

describe('NALI.ai restore composer safeguards', () => {
  it('blocks message dispatch on a known failed restore while retaining drafts', async () => {
    const source = await read();
    const send = source.slice(source.indexOf('const sendText = async'), source.indexOf('// Refresh authoritative conversation history'));
    const guard = send.indexOf('if (!conversationRef.current && (conversationRestoring || restoreError)) {');
    expect(send).toContain('const conversationRestoring = !conversationRef.current && (restorePending || Boolean(conversationInitRef.current));');
    expect(guard).toBeGreaterThan(0);
    expect(guard).toBeLessThan(send.indexOf('sendInFlightRef.current = true;'));
    expect(send.slice(guard, send.indexOf('if (subscriptionLoading', guard))).toContain('return;');
    expect(send.slice(guard, send.indexOf('if (subscriptionLoading', guard))).toContain('setContextPrompt(text);\n        setInput(current => current || text);');
  });
  it('keeps the composer editable and disables Send during pending/failed restoration', async () => {
    const source = await read();
    expect(source).toContain('value={input}');
    expect(source).toContain('onChange={e => setInput(e.target.value)}');
    expect(source).toContain('disabled={!input.trim() || loading || (!conversation?.id && (restorePending || restoreError))}');
    expect(source).toContain('Retry before sending; your draft stays here.');
    expect(source).toContain('[conversation, canUseAi, subscriptionLoading, subscriptionError, agentName, restorePending, restoreError]');
  });
});
