// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const read = () => readFile('src/components/AiAssistant.jsx', 'utf8');

describe('NALI.ai contextual prompt recovery during conversation restore', () => {
  it('saves a blocked contextual request as a draft without overwriting an existing draft', async () => {
    const source = await read();
    const send = source.slice(source.indexOf('const sendText = async'), source.indexOf('// Refresh authoritative conversation history'));
    const blocked = send.slice(send.indexOf('if (!conversationRef.current && (conversationRestoring || restoreError)) {'), send.indexOf('if (subscriptionLoading', send.indexOf('const conversationRestoring')));
    expect(blocked).toContain('keepContextPrompt(text);');
    expect(blocked.indexOf('setInput(current => current || text)')).toBeLessThan(blocked.indexOf('return;'));
    expect(blocked).not.toContain('sendAgentText(');
    expect(blocked).not.toContain('initConversation(');
  });
  it('does not silently send preserved prompts following a manual restoration retry', async () => {
    const source = await read();
    const retry = source.slice(source.indexOf('{restoreError && !conversation?.id && ('), source.indexOf('{sendError && ('));
    expect(retry).toContain('onClick={() => void openChat()}');
    expect(retry).not.toContain('sendText(');
    expect(retry).not.toContain('sendAgentText(');
    expect(source).toContain('await sendText(text, { preserveDraft: true });');
    expect(source).toContain('if (greeting) {\n      await sendText(greeting, { preserveDraft: true });');
  });
});
