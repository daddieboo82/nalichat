// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const read = () => readFile('src/components/AiAssistant.jsx', 'utf8');
describe('NALI.ai bounded delayed-reply recovery', () => {
  it('tracks delayed status after the first minute and clears it on reply, error, or account switch', async () => {
    const source = await read();
    expect(source).toContain('const [replyDelayed, setReplyDelayed] = useState(false);');
    expect(source).toContain('setReplyDelayed(true);');
    expect(source).toContain('setReplyDelayed(false);');
    expect(source).toContain('}, 60000);');
    expect(source).toContain('Still waiting for Nali. We’re checking for your reply without resending.');
  });
  it('runs at most four additional history checks while tab is visible and online', async () => {
    const source = await read();
    const start = source.indexOf('// A silent WebSocket failure');
    const end = source.indexOf('const send = () => sendText(input);', start);
    const recovery = source.slice(start, end);
    expect(recovery).toContain('if (!replyDelayed || !loading || !conversation?.id) return;');
    expect(recovery).toContain("document.visibilityState !== 'visible' || !navigator.onLine");
    expect(recovery).toContain('if (checks === 4) clearInterval(interval);');
    expect(recovery).toContain('void refreshPendingReply({ quiet: true });');
    expect(recovery).toContain('return () => clearInterval(interval);');
    expect(recovery).not.toContain('sendAgentText(');
    expect(recovery).not.toContain('sendText(');
  });
});
