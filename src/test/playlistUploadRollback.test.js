// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('playlist upload rollback', () => {
  it('checks structured delete errors instead of silently accepting failed cleanup', async () => {
    const source = await readText('src/pages/PlaylistDetail.jsx');

    expect(source).toContain('const cleanup = await base44.functions.invoke("deleteArtPost"');
    expect(source).toContain('if (cleanup?.data?.error) throw new Error(cleanup.data.error);');
    expect(source).toContain('rollback failed:');
    expect(source).not.toContain('await base44.functions.invoke("deleteArtPost", { postId: newPost.id });\n        } catch {}');
  });
});
