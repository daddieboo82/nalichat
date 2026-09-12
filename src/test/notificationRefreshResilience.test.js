// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('notification refresh resilience', () => {
  it('prevents overlapping polls and avoids post-unmount permission state updates', async () => {
    const source = await readText('src/components/notifications/NotificationBell.jsx');
    expect(source).toContain('let refreshInFlight = false;');
    expect(source).toContain('if (refreshInFlight) return;');
    expect(source).toContain('refreshInFlight = true;');
    expect(source).toContain('finally {\n        refreshInFlight = false;');
    expect(source).toContain('if (!cancelled) setPushPermission(getPermissionStatus());');
    expect(source).toContain('return () => {\n      cancelled = true;');
  });
});
