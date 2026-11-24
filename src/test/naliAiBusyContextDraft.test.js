// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const read = () => readFile('src/components/AiAssistant.jsx', 'utf8');

describe('NALI.ai busy contextual prompt safeguards', () => {
  it('preserves contextual prompts arriving during an in-flight AI request', async () => {
    const source = await read();
    const send = source.slice(source.indexOf('const sendText = async'), source.indexOf('// Refresh authoritative conversation history'));
    const start = send.indexOf('if (sendInFlightRef.current) {');
    const end = send.indexOf('// All send entry points', start);
    const busy = send.slice(start, end);
    expect(busy).toContain('setContextPrompt(text);\n        setInput(current => current || text);');
    expect(busy).toContain('return;');
    expect(busy).not.toContain('sendAgentText(');
    expect(busy).not.toContain('initConversation(');
    expect(start).toBeLessThan(send.indexOf('sendInFlightRef.current = true;'));
  });
  it('does not overwrite an existing draft or auto-send the preserved prompt', async () => {
    const source = await read();
    expect(source).toContain('setInput(current => current || text);');
    expect(source).toContain('await sendText(text, { preserveDraft: true });');
    expect(source).toContain('await sendText(greeting, { preserveDraft: true });');
    const retry = source.slice(source.indexOf('{restoreError && !conversation?.id && ('), source.indexOf('{sendError && ('));
    expect(retry).not.toContain('sendAgentText(');
  });
});
