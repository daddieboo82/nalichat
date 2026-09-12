import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('mastering post id validation', () => {
  it('validates postId before ArtPost lookup', async () => {
    const s=await readFile('base44/functions/bounceAndMaster/entry.ts','utf8');
    const check=s.indexOf('isBase44EntityId(normalizedPostId)');
    const lookup=s.indexOf('ArtPost.get(normalizedPostId)');
    expect(check).toBeGreaterThan(-1);
    expect(lookup).toBeGreaterThan(check);
  });
});
