import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio stem track IDs', () => {
  it('uses the safe track-id allocator for persisted string IDs', async () => {
    const s = await readFile('src/pages/Studio.jsx', 'utf8');
    expect(s).toContain('const nextId = nextTrackId(tracks);');
    expect(s).not.toContain('Math.max(...tracks.map(t => t.id)) + 1');
  });
});
