// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('push registration across account changes', () => {
  it('re-registers an already-authorized push endpoint for the active account', async () => {
    const source = await readFile('src/components/notifications/NotificationBell.jsx', 'utf8');
    expect(source).toContain("if (!user?.id || getPermissionStatus() !== 'granted') return;");
    expect(source).toContain('void subscribeToRemotePush()');
    expect(source).toContain('generation === identityGenerationRef.current');
    expect(source).toContain('Push re-registration failed:');
    expect(source).toContain('}, [user?.id]);');
  });

  it('does not request notification permission from the identity-change effect', async () => {
    const source = await readFile('src/components/notifications/NotificationBell.jsx', 'utf8');
    const marker = source.indexOf("if (!user?.id || getPermissionStatus() !== 'granted') return;");
    const nextEffect = source.indexOf('useEffect(() => {', marker + 1);
    const block = source.slice(marker, nextEffect);
    expect(block).not.toContain('requestPushPermission()');
  });
});
