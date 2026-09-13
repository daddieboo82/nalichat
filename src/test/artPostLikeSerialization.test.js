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
    expect(source).toContain('isBase44EntityId(postId)');
    expect(source).toContain('status: 409');
    const lock = source.indexOf('const lockId = await acquireArtPostEngagementLock');
    const lockedRead = source.indexOf('const post = await entities.ArtPost.get(postId)', lock);
    expect(lock).toBeGreaterThan(-1);
    expect(lockedRead).toBeGreaterThan(lock);
  });
});
