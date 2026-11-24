// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const read = () => readFile('src/components/AiAssistant.jsx', 'utf8');

describe('NALI.ai initialization failure from send entry points', () => {
  it('routes a pre-dispatch conversation failure to the safe retry UI', async () => {
    const source = await read();
    const send = source.slice(source.indexOf('const sendText = async'), source.indexOf('// Refresh authoritative conversation history'));
    const start = send.indexOf('if (!dispatchStarted && !conv) {');
    expect(start).toBeGreaterThan(0);
    const branch = send.slice(start, send.indexOf('\n    }\n  };', start));
    expect(branch).toContain('setContextPrompt(text);\n        setInput(current => current || text);');
    expect(branch).toContain('setRestoreError(true);');
    expect(branch.indexOf('setInput(current => current || text)')).toBeLessThan(branch.indexOf('setRestoreError(true)'));
    expect(branch).toContain('setSendError(null);');
    expect(branch).toContain('setSendError(friendlyNaliError(err));');
    expect(send.indexOf('if (!preserveDraft) setInput(current => current || text);')).toBeLessThan(start);
    expect(send.indexOf('sendInFlightRef.current = false;')).toBeLessThan(start);
  });
  it('does not turn uncertain already-dispatched errors into restore failures', async () => {
    const source = await read();
    const send = source.slice(source.indexOf('const sendText = async'), source.indexOf('// Refresh authoritative conversation history'));
    expect(send.indexOf('if (dispatchStarted && isUncertainAiDelivery(err)) {')).toBeLessThan(send.indexOf('if (!dispatchStarted && !conv) {'));
    expect(source).toContain('Retry conversation');
  });
});
