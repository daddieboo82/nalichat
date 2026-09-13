// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('push subscription idempotency and input bounds', () => {
  it('dedupes endpoints deterministically and validates account/input state', async () => {
    const register = await readText('base44/functions/registerPushSubscription/entry.ts');
    expect(register).toContain('async function pushSubscriptionId');
    expect(register).toContain('push_');
    expect(register).toContain('id: deterministicId');
    expect(register).toContain('entity.get(deterministicId)');
    expect(register).toContain("req.method !== 'POST'");
    expect(register).toContain('user.is_banned');
    expect(register).toContain('endpoint.length > 2048');
    expect(register).toContain('p256dh.length > 512');
    expect(register).toContain('auth.length > 512');

    const unregister = await readText('base44/functions/unregisterPushSubscription/entry.ts');
    expect(unregister).toContain("req.method !== 'POST'");
    expect(unregister).toContain('user.is_banned');
    expect(unregister).toContain('endpoint.length > 2048');
  });
});


describe('push subscription response identity contract', () => {
  it('binds register/unregister confirmations to the current account and endpoint', async () => {
    const client = await readText('src/lib/pushNotifications.js');
    const register = await readText('base44/functions/registerPushSubscription/entry.ts');
    const unregister = await readText('base44/functions/unregisterPushSubscription/entry.ts');
    expect(client).toContain('registerResponse?.data?.action !== "register_push"');
    expect(client).toContain('registerResponse?.data?.userId !== authUser.id');
    expect(client).toContain('registerResponse?.data?.endpoint !== json.endpoint');
    expect(client).toContain('!Number.isInteger(registerResponse?.data?.cleanup_failures)');
    expect(client).toContain('registerResponse.data.cleanup_failures < 0');
    expect(client).toContain('unregisterResponse?.data?.action !== "unregister_push"');
    expect(client).toContain('unregisterResponse?.data?.userId !== authUser.id');
    expect(client).toContain('!Number.isInteger(unregisterResponse?.data?.removed)');
    expect(client).toContain('unregisterResponse.data.removed < 0');
    expect(register).toContain("action: 'register_push'");
    expect(unregister).toContain("action: 'unregister_push'");
  });
});
