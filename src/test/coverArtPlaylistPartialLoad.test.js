import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Cover Art playlist loading', () => {
  it('surfaces unavailable playlist tracks instead of silently dropping them', async () => {
    const s = await readFile('src/pages/CoverArt.jsx', 'utf8');
    expect(s).toContain('Promise.allSettled(');
    expect(s).toContain('unavailableCount');
    expect(s).toContain("couldn't be loaded. Showing the tracks that are available.");
    expect(s).not.toContain('tracks.push(await base44.entities.ArtPost.get(id));');
  });
});
