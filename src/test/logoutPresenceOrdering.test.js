// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('logout presence ordering', () => {
  it('marks the user offline before ending the authenticated server session', async () => {
    const source = await readFile('src/lib/AuthContext.jsx', 'utf8');
    const offline = source.indexOf("base44.functions.invoke('updateUserPresence', { isOnline: false })");
    const logout = source.indexOf('await base44.auth.logout()');
    expect(offline).toBeGreaterThanOrEqual(0);
    expect(logout).toBeGreaterThan(offline);
    expect(source).toContain("presenceResponse?.data?.action !== 'update_presence'");
    expect(source).toContain('presenceResponse?.data?.userId !== expectedUserId');
    expect(source).toContain('presenceResponse?.data?.isOnline !== false');
    expect(source).toContain("presenceResponse?.data?.success !== true");
    expect(source).toContain("Offline presence was not confirmed.");
    expect(source).toContain("console.error('Presence offline update failed:', error)");
  });
});
