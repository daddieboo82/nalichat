import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('app-wide user presence', () => {
  it('maintains presence from the authenticated app shell', async () => {
    const app = await readFile('src/App.jsx', 'utf8');
    expect(app).toContain("base44.functions.invoke('updateUserPresence', { isOnline })");
    expect(app).toContain("res?.data?.success !== true");
    expect(app).toContain("res?.data?.action !== 'update_presence'");
    expect(app).toContain('res?.data?.userId !== user.id');
    expect(app).toContain('res?.data?.isOnline !== isOnline');
    expect(app).toContain("Presence update was not confirmed.");
    expect(app).toContain("document.addEventListener('visibilitychange', syncVisibility)");
    expect(app).toContain("window.addEventListener('pagehide', handlePageHide)");
    expect(app).toContain("window.addEventListener('pageshow', handlePageShow)");
    expect(app).toContain("window.removeEventListener('pagehide', handlePageHide)");
    expect(app).toContain("window.removeEventListener('pageshow', handlePageShow)");
    expect(app).toContain('60_000');
    expect(app).toContain('}, [isAuthenticated, user?.id]);');
  });

  it('refreshes presence on the presence-sensitive Messages surface', async () => {
    const messages = await readFile('src/pages/Messages.jsx', 'utf8');
    expect(messages).toContain("base44.functions.invoke('updateUserPresence', { isOnline: true })");
    expect(messages).toContain('const presenceHeartbeat = window.setInterval(refreshMessagesPresence, 30_000);');
    expect(messages).toContain('window.clearInterval(presenceHeartbeat);');
    expect(messages).toContain('queryKey: ["messages", currentUser?.id, selectedConvId]');
    expect(messages).toContain('queryKey: ["users", "presence", currentUser.id]');
  });
});
