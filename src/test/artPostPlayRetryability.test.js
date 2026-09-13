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
    expect(source).toContain('isBase44EntityId(postId)');
    expect(source).toContain('await entities.ArtPostPlay.delete(id)');
    expect(source.indexOf('ArtPostPlay.delete(id)')).toBeGreaterThan(
      source.indexOf('$inc: { views: 1 }'),
    );
  });
});


  it('binds play confirmation to the authenticated listener and exact post', async () => {
    const backend = await readText('base44/functions/recordArtPostPlay/entry.ts');
    const client = await readText('src/lib/trackAnalytics.js');
    expect(backend).toContain("action: 'record_art_post_play'");
    expect(backend).toContain('userId: user.id');
    expect(backend).toContain('postId');
    expect(client).toContain("data?.action !== 'record_art_post_play'");
    expect(client).toContain('data?.userId !== expectedUserId');
    expect(client).toContain('data?.postId !== postId');
  });
