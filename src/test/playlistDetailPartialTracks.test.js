import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('playlist detail partial tracks', () => {
  it('warns when some playlist tracks cannot be loaded', async () => {
    const s = await readFile('src/pages/PlaylistDetail.jsx', 'utf8');
    expect(s).toContain('Promise.allSettled(');
    expect(s).toContain('unavailableCount');
    expect(s).toContain("couldn't be loaded. Showing the tracks that are available.");
    expect(s).not.toContain('ArtPost.get(id).catch(() => null)');
  });
});
