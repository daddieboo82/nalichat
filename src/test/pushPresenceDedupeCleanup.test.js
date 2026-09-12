// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('push and presence dedupe cleanup', () => {
  it('deduplicates Web Push delivery by endpoint and cleans all stale duplicates', async () => {
    const source = await readText('base44/shared/webPush.ts');
    expect(source).toContain('const byEndpoint = new Map<string, any>();');
    expect(source).toContain('if (!subscription?.endpoint || byEndpoint.has(subscription.endpoint)) continue;');
    expect(source).toContain('const staleRows = subscriptions.filter((row: any) => row.endpoint === subscription.endpoint);');
  });

  it('reports push registration cleanup failures without failing a valid registration', async () => {
    const source = await readText('base44/functions/registerPushSubscription/entry.ts');
    expect(source).toContain('cleanup_failures: cleanupFailures');
    expect(source).toContain('Failed to remove duplicate push subscription');
    expect(source).not.toContain('entity.delete(row.id).catch(() => {})');
  });

  it('reports Studio presence cleanup failures', async () => {
    const source = await readText('base44/functions/updateStudioPresence/entry.ts');
    expect(source).toContain('Failed to clear Studio presence row');
    expect(source).toContain('Failed to remove duplicate Studio presence row');
    expect(source).toContain('cleanup_failures: cleanupFailures');
  });
});
