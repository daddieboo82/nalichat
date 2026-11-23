// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const read = () => readFile('src/components/AiAssistant.jsx', 'utf8');

describe('NALI.ai already-dispatched requests', () => {
  it('recognizes server-side reserved and dispatched statuses including SDK error responses', async () => {
    const code = await read();
    expect(code).toContain("error?.response?.data?.code || error?.data?.code || error?.code");
    expect(code).toContain("code === 'AI_REQUEST_IN_PROGRESS' || code === 'AI_REQUEST_ALREADY_DISPATCHED'");
  });

  it('preserves pending state and fetches history without resending the AI request', async () => {
    const code = await read();
    const start = code.indexOf('if (isAlreadyDispatchedAiRequest(err)) {');
    const end = code.indexOf('// A realtime answer can arrive', start);
    expect(start).toBeGreaterThan(0);
    const branch = code.slice(start, end);
    expect(branch).toContain('setReplyDelayed(true);');
    expect(branch).toContain('void refreshPendingReply({ quiet: true });');
    expect(branch).toContain('return;');
    expect(branch).not.toContain('sendInFlightRef.current = false');
    expect(branch).not.toContain('sendAgentText(');
    expect(branch).not.toContain('setInput(');
  });
});
