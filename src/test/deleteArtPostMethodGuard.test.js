// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('deleteArtPost method guard', () => {
  it('requires POST before destructive deletion work', async () => {
    const source = await readText('base44/functions/deleteArtPost/entry.ts');

    const methodGuard = source.indexOf("if (req.method !== 'POST')");
    const authCheck = source.indexOf('const base44 = createClientFromRequest(req)');
    const deleteCall = source.indexOf('await entities.ArtPost.delete(post.id)');

    expect(methodGuard).toBeGreaterThanOrEqual(0);
    expect(source).toContain("return Response.json({ error: 'Method not allowed' }, { status: 405 });");
    expect(methodGuard).toBeLessThan(authCheck);
    expect(methodGuard).toBeLessThan(deleteCall);
  });
});
