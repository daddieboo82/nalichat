// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const read = () => readFile('src/components/AiAssistant.jsx', 'utf8');

describe('NALI.ai contextual help in an existing conversation', () => {
  it('routes contextual prompts through the shared sender even when a conversation exists', async () => {
    const source = await read();
    const open = source.slice(source.indexOf('const openChat = async (greeting) => {'), source.indexOf('const sendText = async'));
    expect(open).toContain('if (greeting) {\n      await sendText(greeting, { preserveDraft: true });');
    expect(open.indexOf('if (greeting) {')).toBeLessThan(open.indexOf('else if (!conversationRef.current)'));
    expect(open).not.toContain('if (!conversationRef.current) {\n      if (greeting)');
  });
  it('opening without a prompt only restores when necessary and never dispatches AI', async () => {
    const source = await read();
    const open = source.slice(source.indexOf('const openChat = async (greeting) => {'), source.indexOf('const sendText = async'));
    expect(open).toContain('} else if (!conversationRef.current) {');
    expect(open).toContain('await initConversation();');
    expect(open).not.toContain('sendAgentText(');
  });
});
