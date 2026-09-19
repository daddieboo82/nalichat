// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('entitlement and push cleanup bounds', () => {
  it('keeps Nali Transfer free of legacy subscription size gating', async () => {
    const source = await readText('base44/functions/createSharedFileRecord/entry.ts');
    expect(source).not.toContain('resolveUserSubscription(');
    expect(source).not.toContain('hasPaidAccess');
    expect(source).not.toContain('Subscription.filter({ user_id: userId })');
  });

  it('deletes matching push subscriptions in bounded batches', async () => {
    const source = await readText('base44/functions/unregisterPushSubscription/entry.ts');
    expect(source).toContain('const DELETE_BATCH_SIZE = 200;');
    expect(source).toMatch(/entity\.filter\([\s\S]*user_id: user\.id, endpoint[\s\S]*DELETE_BATCH_SIZE/);
    expect(source).toContain('removed += 1');
    expect(source).toMatch(/Response\.json\(\{[\s\S]*success: true,[\s\S]*removed,[\s\S]*\}\)/);
  });
});
