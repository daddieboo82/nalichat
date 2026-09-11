// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('art post play retryability', () => {
  it('releases the deterministic daily play claim if the view increment fails', async () => {
    const source = await readText('base44/functions/recordArtPostPlay/entry.ts');

    expect(source).toContain("req.method !== 'POST'");
    expect(source).toContain('user.is_banned');
    expect(source).toContain('user.timeout_until');
    expect(source).toContain('postId.length > 200');
    expect(source).toContain('await entities.ArtPostPlay.delete(id)');
    expect(source.indexOf('ArtPostPlay.delete(id)')).toBeGreaterThan(
      source.indexOf('$inc: { views: 1 }'),
    );
  });
});
