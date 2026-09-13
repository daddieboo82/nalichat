import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('ArtPost view/play lifecycle serialization', () => {
  it('serializes play tracking with ArtPost deletion and verifies the counter update', async () => {
    const s = await readFile('base44/functions/recordArtPostPlay/entry.ts', 'utf8');
    const preview = s.indexOf('const postPreview = await entities.ArtPost.get(postId)');
    const lock = s.indexOf('const lockId = await acquireArtPostEngagementLock');
    const recheck = s.indexOf('const post = await entities.ArtPost.get(postId)', lock);
    const ledger = s.indexOf('await entities.ArtPostPlay.create({', recheck);
    const count = s.indexOf('const countUpdate = await entities.ArtPost.updateMany', ledger);

    expect(preview).toBeGreaterThan(-1);
    expect(lock).toBeGreaterThan(preview);
    expect(recheck).toBeGreaterThan(lock);
    expect(ledger).toBeGreaterThan(recheck);
    expect(count).toBeGreaterThan(ledger);
    expect(s).toContain('Number(countUpdate?.updated || 0) !== 1');
    expect(s).toContain('entities.ArtPostPlay.delete(id)');
    expect(s).toContain('releaseArtPostEngagementLock(entities, lockId)');
  });

  it('serializes hourly view tracking with deletion and releases the rate claim on failed updates', async () => {
    const s = await readFile('base44/functions/recordArtPostView/entry.ts', 'utf8');
    const preview = s.indexOf('const postPreview = await entities.ArtPost.get(postId)');
    const lock = s.indexOf('const lockId = await acquireArtPostEngagementLock');
    const recheck = s.indexOf('const post = await entities.ArtPost.get(postId)', lock);
    const claim = s.indexOf('artpost_view:', recheck);
    const count = s.indexOf('const countUpdate = await entities.ArtPost.updateMany', claim);

    expect(preview).toBeGreaterThan(-1);
    expect(lock).toBeGreaterThan(preview);
    expect(recheck).toBeGreaterThan(lock);
    expect(claim).toBeGreaterThan(recheck);
    expect(count).toBeGreaterThan(claim);
    expect(s).toContain('Number(countUpdate?.updated || 0) !== 1');
    expect(s).toContain('releaseSingleHourlyClaim(');
    expect(s).toContain('releaseArtPostEngagementLock(entities, lockId)');
  });
});
