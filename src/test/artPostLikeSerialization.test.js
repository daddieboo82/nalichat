// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('art post like serialization', () => {
  it('serializes toggle/read/count reconciliation per post', async () => {
    const helper = await readText('base44/shared/artPostEngagementLock.ts');
    expect(helper).toContain('ART_POST_ENGAGEMENT_LOCK_TTL_MS = 2 * 60 * 1000');
    expect(helper).toContain('ArtPostEngagementLock.create');
    expect(helper).toContain('ArtPostEngagementLock.delete');

    const source = await readText('base44/functions/toggleLike/entry.ts');
    expect(source).toContain("req.method !== 'POST'");
    expect(source).toContain('acquireArtPostEngagementLock');
    expect(source).toContain('releaseArtPostEngagementLock');
    expect(source).toContain('postId.length > 200');
    expect(source).toContain('status: 409');
    expect(source.indexOf('acquireArtPostEngagementLock')).toBeLessThan(
      source.indexOf('entities.ArtPost.get(postId)'),
    );
  });
});
