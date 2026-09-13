// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('notification account isolation', () => {
  it('clears private notification state before loading a new identity', async () => {
    const source = await readFile('src/components/notifications/NotificationBell.jsx', 'utf8');
    const effectStart = source.indexOf('identityGenerationRef.current += 1;');
    const authGate = source.indexOf('if (!user?.id) return;', effectStart);
    expect(effectStart).toBeGreaterThan(-1);
    expect(source.indexOf('setItems([]);', effectStart)).toBeLessThan(authGate);
    expect(source.indexOf('setOpen(false);', effectStart)).toBeLessThan(authGate);
    expect(source).toContain('}, [user?.id, lockedChatsReady, lockedConversationIds]);');
  });
});
