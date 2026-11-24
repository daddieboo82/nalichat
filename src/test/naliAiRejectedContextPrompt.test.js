// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const read = () => readFile('src/components/AiAssistant.jsx', 'utf8');

describe('NALI.ai rejected contextual sends', () => {
  it('keeps rejected contextual prompts editable without overwriting an existing draft', async () => {
    const source = await read();
    const send = source.slice(source.indexOf('const sendText = async'), source.indexOf('// Refresh authoritative conversation history'));
    const uncertain = send.indexOf('if (dispatchStarted && isUncertainAiDelivery(err)) {');
    const restore = send.indexOf('if (!preserveDraft) setInput(current => current || text);', uncertain);
    const contextual = send.indexOf('else keepContextPrompt(text);', restore);
    expect(uncertain).toBeGreaterThan(0);
    expect(restore).toBeGreaterThan(uncertain);
    expect(contextual).toBeGreaterThan(restore);
    expect(contextual).toBeLessThan(send.indexOf('setSendError(friendlyNaliError(err));'));
    expect(source).toContain('setInput(current => current || text);');
  });
  it('never restores a possibly dispatched request merely due to an uncertain transport failure', async () => {
    const source = await read();
    const send = source.slice(source.indexOf('const sendText = async'), source.indexOf('// Refresh authoritative conversation history'));
    const uncertain = send.slice(send.indexOf('if (dispatchStarted && isUncertainAiDelivery(err)) {'), send.indexOf('// A realtime answer can arrive'));
    expect(uncertain).toContain('void refreshPendingReply({ quiet: true });');
    expect(uncertain).toContain('return;');
    expect(uncertain).not.toContain('keepContextPrompt(text)');
  });
});
