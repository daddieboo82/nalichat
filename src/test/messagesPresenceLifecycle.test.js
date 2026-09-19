import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Messages presence lifecycle', () => {
  it('keeps Messages presence fresh while following the active conversation lifecycle', async () => {
    const source = await readFile('src/pages/Messages.jsx', 'utf8');
    expect(source).toContain("base44.functions.invoke('updateUserPresence', { isOnline: true })");
    expect(source).toContain('document.visibilityState !== "visible"');
    expect(source).toContain('const presenceHeartbeat = window.setInterval(refreshMessagesPresence, 30_000);');
    expect(source).toContain('window.clearInterval(presenceHeartbeat);');
    expect(source).toContain('queryKey: ["messages", currentUser?.id, selectedConvId]');
    expect(source).toContain('}, [currentUser?.id, queryClient, selectedConvId]);');
  });
});
