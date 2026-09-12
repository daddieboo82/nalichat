import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('art post engagement ordering', () => {
  it('validates and rate-limits view lookups before post reads', async () => {
    const source = await readFile('base44/functions/recordArtPostView/entry.ts', 'utf8');
    expect(source).toContain('isBase44EntityId(postId)');
    expect(source).toContain("'artpost_view_lookup'");
    expect(source.indexOf('consumeHourlyLimit(')).toBeLessThan(source.indexOf('entities.ArtPost.get(postId)'));
  });

  it('checks like targets before acquiring engagement locks', async () => {
    const source = await readFile('base44/functions/toggleLike/entry.ts', 'utf8');
    expect(source).toContain('isBase44EntityId(postId)');
    expect(source).toContain('postPreview');
    expect(source.indexOf('postPreview')).toBeLessThan(source.indexOf('acquireArtPostEngagementLock(entities, postId)'));
  });
});
