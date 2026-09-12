import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('ArtPost cover mutation hardening', () => {
  it('requires trusted uploaded cover art and a valid entity id', async () => {
    const source = await readFile('base44/functions/mutateArtPost/entry.ts', 'utf8');
    expect(source).toContain('isBase44EntityId(postId)');
    expect(source).toContain('TRUSTED_MEDIA_HOSTS');
    expect(source).toContain("Cover art must come from trusted upload storage");
    expect(source.indexOf('isBase44EntityId(postId)')).toBeLessThan(source.indexOf('entities.ArtPost.get(postId)'));
  });
});
