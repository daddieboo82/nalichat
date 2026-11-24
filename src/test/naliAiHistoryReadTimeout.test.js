// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { withNaliHistoryTimeout } from '@/lib/naliHistoryTimeout';

afterEach(() => vi.useRealTimers());

describe('NALI.ai bounded history-only refresh', () => {
  it('returns an existing reply when the read finishes in time', async () => {
    vi.useFakeTimers();
    const result = await withNaliHistoryTimeout(Promise.resolve({ id: 'existing' }), 1000);
    expect(result).toEqual({ id: 'existing' });
    expect(vi.getTimerCount()).toBe(0);
  });
  it('rejects a stuck read and clears its timer, leaving retry possible', async () => {
    vi.useFakeTimers();
    let finish;
    const pending = new Promise(resolve => { finish = resolve; });
    const attempt = withNaliHistoryTimeout(pending, 1000);
    const assertion = expect(attempt).rejects.toThrow('Conversation refresh timed out');
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
    finish({ messages: ['late response'] });
    await Promise.resolve();
    await expect(withNaliHistoryTimeout(Promise.resolve({ messages: ['new attempt'] }), 1000)).resolves.toEqual({ messages: ['new attempt'] });
  });
  it('bounds only getConversation recovery, never dispatches another AI message', async () => {
    const source = await readFile('src/components/AiAssistant.jsx', 'utf8');
    const start = source.indexOf('const refreshPendingReply = async');
    const end = source.indexOf('const send = () => sendText(input);', start);
    const refresh = source.slice(start, end);
    expect(refresh).toContain('await withNaliHistoryTimeout(base44.agents.getConversation(conv.id))');
    expect(refresh).toContain('replyRefreshInFlightRef.current = false;');
    expect(refresh).not.toContain('sendAgentText(');
    expect(refresh).not.toContain('sendText(');
  });
});
