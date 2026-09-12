// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('notification delivery deduplication', () => {
  it('uses in-app toast for foreground polling without creating a second browser notification', async () => {
    const source = await readText('src/components/notifications/NotificationBell.jsx');

    expect(source).not.toContain('showPushNotification');
    expect(source).toContain('toast({ title: safeNewest.actor_name || "New activity"');
    expect(source).toContain('subscribeToRemotePush');
  });
});
