// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('push subscription result handling', () => {
  it('rejects structured registration errors and cleans up new local subscriptions', async () => {
    const source = await readText('src/lib/pushNotifications.js');

    expect(source).toContain('if (configResponse?.data?.error) throw new Error(configResponse.data.error);');
    expect(source).toContain('config.action !== "get_push_config"');
    expect(source).toContain('typeof config.configured !== "boolean"');
    expect(source).toContain('typeof config.publicKey !== "string"');
    expect(source).toContain('Push configuration was not confirmed.');
    expect(source).toContain('if (registerResponse?.data?.error) throw new Error(registerResponse.data.error);');
    expect(source).toContain('if (createdSubscription)');
    expect(source).toContain('await subscription.unsubscribe()');
  });

  it('always attempts local unsubscribe on logout while surfacing server cleanup failure', async () => {
    const source = await readText('src/lib/pushNotifications.js');

    expect(source).toContain('let serverError = null;');
    expect(source).toContain('localUnsubscribed = await subscription.unsubscribe();');
    expect(source).toContain('if (serverError) throw serverError;');
  });

  it('shows a user-facing error when push cannot actually register', async () => {
    const source = await readText('src/components/notifications/NotificationBell.jsx');

    expect(source).toContain('title: "Notifications not enabled"');
    expect(source).toContain('Push registration failed. Please try again.');
  });
});
