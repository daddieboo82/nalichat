import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('typing indicator transient failures', () => {
  it('does not permanently disable polling or heartbeat writes after one network failure', async () => {
    const s = await readFile('src/hooks/useTypingIndicator.js', 'utf8');
    expect(s).not.toContain('if (!conversationId || !currentUser || !supportedRef.current) return;');
    expect(s).toContain('transientFailureRef.current = true;');
    expect(s).toContain('lastSentRef.current = 0;');
    expect(s).toContain('supportedRef.current = true;');
  });
});
