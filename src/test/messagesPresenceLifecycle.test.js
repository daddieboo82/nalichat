import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Messages presence lifecycle', () => {
  it('keeps Messages presence fresh while following the active conversation lifecycle', async () => {
    const source = await readFile('src/pages/Messages.jsx', 'utf8');
    expect(source).toContain("base44.functions.invoke('updateUserPresence', { isOnline: true })");
    expect(source).toContain('if (res?.data?.error) throw new Error(res.data.error)');
    expect(source).toContain("res?.data?.action !== 'update_presence'");
    expect(source).toContain('res?.data?.userId !== currentUser.id');
    expect(source).toContain('res?.data?.isOnline !== true');
    expect(source).toContain('Presence heartbeat was not confirmed.');
    expect(source).toContain('document.visibilityState !== "visible"');
    expect(source).toContain('const presenceHeartbeat = window.setInterval(refreshMessagesPresence, 30_000);');
    expect(source).toContain('window.clearInterval(presenceHeartbeat);');
    expect(source).toContain('queryKey: ["messages", currentUser?.id, selectedConvId]');
    expect(source).toContain('}, [currentUser?.id, queryClient, selectedConvId]);');
  });
});
