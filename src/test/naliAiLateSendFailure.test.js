// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const source = () => readFile('src/components/AiAssistant.jsx', 'utf8');

describe('NALI.ai recovery and late endpoint errors', () => {
  it('does not convert a delivered reply into a false send failure', async () => {
    const code = await source();
    expect(code).toContain('requestSequence !== sendSequenceRef.current || !sendInFlightRef.current) return;');
    expect(code).toContain('setSendError(friendlyNaliError(err));');
    expect(code).toContain('if (!preserveDraft) setInput(current => current || text);');
  });

  it('uses one coalesced history-only fetch for manual, reconnect and timeout recovery', async () => {
    const code = await source();
    const timeoutStart = code.indexOf('loadingTimerRef.current = setTimeout(() => {');
    const refreshStart = code.indexOf('const refreshPendingReply = async ({ quiet = false } = {}) => {');
    const sendStart = code.indexOf('const send = () => sendText(input);', refreshStart);
    expect(timeoutStart).toBeGreaterThan(-1);
    expect(code.slice(timeoutStart, code.indexOf('}, 60000);', timeoutStart))).toContain('void refreshPendingReply({ quiet: true });');
    const refresh = code.slice(refreshStart, sendStart);
    expect(refresh).toContain('replyRefreshInFlightRef.current');
    expect(refresh).toContain('base44.agents.getConversation(conv.id)');
    expect(refresh).not.toContain('sendAgentText(');
  });
});
