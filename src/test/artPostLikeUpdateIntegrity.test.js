import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('ArtPost like update integrity', () => {
  it('requires exactly one post row to receive the like toggle', async () => {
    const s = await readFile('base44/functions/toggleLike/entry.ts', 'utf8');
    expect(s).toContain('const likeUpdate = alreadyLiked');
    expect(s).toContain('Number(likeUpdate?.updated || 0) !== 1');
    expect(s).toContain('Like update did not apply. Please retry.');
  });
});
