import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('app-wide user presence', () => {
  it('maintains presence from the authenticated app shell', async () => {
    const app = await readFile('src/App.jsx', 'utf8');
    expect(app).toContain("base44.functions.invoke('updateUserPresence', { isOnline })");
    expect(app).toContain("document.addEventListener('visibilitychange', syncVisibility)");
    expect(app).toContain("window.addEventListener('pagehide', handlePageHide)");
    expect(app).toContain("window.addEventListener('pageshow', handlePageShow)");
    expect(app).toContain("window.removeEventListener('pagehide', handlePageHide)");
    expect(app).toContain("window.removeEventListener('pageshow', handlePageShow)");
    expect(app).toContain('60_000');
    expect(app).toContain('}, [isAuthenticated, user?.id]);');
  });

  it('does not run a second presence heartbeat inside Messages', async () => {
    const messages = await readFile('src/pages/Messages.jsx', 'utf8');
    expect(messages).not.toContain('functions.invoke("updateUserPresence"');
    expect(messages).toContain('Presence itself is maintained app-wide in App.jsx.');
    expect(messages).toContain('queryKey: ["messages", currentUser?.id, selectedConvId]');
  });
});
