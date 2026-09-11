// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('art post view retryability', () => {
  it('releases a single-slot hourly claim if the counter increment fails', async () => {
    const helper = await readText('base44/shared/rateLimit.ts');
    expect(helper).toContain('export async function releaseSingleHourlyClaim');
    expect(helper).toContain('Number(row?.count || 0) === 1');
    expect(helper).toContain('UsageRateLimit.delete(id)');

    const source = await readText('base44/functions/recordArtPostView/entry.ts');
    expect(source).toContain("req.method !== 'POST'");
    expect(source).toContain('user.is_banned');
    expect(source).toContain('postId.length > 200');
    expect(source).toContain('releaseSingleHourlyClaim');
    expect(source.indexOf('releaseSingleHourlyClaim')).toBeGreaterThan(
      source.indexOf('$inc: { views: 1 }'),
    );
  });
});
