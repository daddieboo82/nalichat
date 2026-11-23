// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const read = () => readFile('src/components/AiAssistant.jsx', 'utf8');

describe('NALI.ai reconnect recovery without duplicate dispatches', () => {
  it('checks for existing replies when the browser reconnects or a tab becomes visible', async () => {
    const source = await read();
    expect(source).toContain("window.addEventListener('online', checkOnReconnect)");
    expect(source).toContain("window.addEventListener('pageshow', checkOnPageShow)");
    expect(source).toContain("window.removeEventListener('pageshow', checkOnPageShow)");
    expect(source).toContain("const checkOnPageShow = () => {\n      if (document.visibilityState === 'visible') checkOnReconnect();");
    expect(source).toContain("document.addEventListener('visibilitychange', checkOnVisibility)");
    expect(source).toContain("document.visibilityState === 'visible'");
    expect(source).toContain("window.removeEventListener('online', checkOnReconnect)");
    expect(source).toContain("document.removeEventListener('visibilitychange', checkOnVisibility)");
    expect(source).toContain('if (!loading || !conversation?.id) return;');
  });

  it('coalesces automatic refreshes while preserving the pending-send guard', async () => {
    const source = await read();
    expect(source).toContain('if (!conv?.id || !sendInFlightRef.current || replyRefreshInFlightRef.current) return;');
    expect(source).toContain('if (quiet && now - lastReplyRefreshAtRef.current < 5000) return;');
    expect(source).toContain('replyRefreshInFlightRef.current = true;');
    expect(source).toContain('if (generation === identityGenerationRef.current && requestSequence === sendSequenceRef.current) replyRefreshInFlightRef.current = false;');
    const start = source.indexOf('const refreshPendingReply = async ({ quiet = false } = {}) => {');
    const end = source.indexOf('const send = () => sendText(input);', start);
    const refresh = source.slice(start, end);
    expect(refresh).toContain('base44.agents.getConversation(conv.id)');
    expect(refresh).not.toContain('sendAgentText(');
    expect(refresh).not.toContain('sendText(');
  });
});
