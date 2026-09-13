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
    expect(source).toContain('isBase44EntityId(postId)');
    expect(source).toContain('releaseSingleHourlyClaim');
    expect(source).toContain("action: 'record_art_post_view'");
    expect(source).toContain('userId: user.id');
    expect(source).toContain('postId');
    expect(source.indexOf('await releaseSingleHourlyClaim')).toBeGreaterThan(
      source.indexOf('$inc: { views: 1 }'),
    );
    it('validates view confirmations against the current viewer and exact post', async () => {
    const client = await readText('src/lib/trackAnalytics.js');
    expect(client).toContain("data?.action !== 'record_art_post_view'");
    expect(client).toContain('data?.userId !== expectedUserId');
    expect(client).toContain('data?.postId !== postId');
  });
});
});
