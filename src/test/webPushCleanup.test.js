// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('web push stale subscription cleanup', () => {
  it('reports stale subscription cleanup failures instead of swallowing them', async () => {
    const source = await readText('base44/shared/webPush.ts');

    expect(source).toContain('staleCleanupFailures');
    expect(source).toContain("Failed to remove stale Web Push subscription");
    expect(source).toContain('cleanupError instanceof Error ? cleanupError.message : String(cleanupError)');
    expect(source).not.toContain('catch (_) {}');
  });
});
