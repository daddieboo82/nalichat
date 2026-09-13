import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('Cover Art import validation', () => {
  it('requires a confirmed ArtPost for Files and device imports', async () => {
    const s = await readFile('src/pages/CoverArt.jsx', 'utf8');
    expect((s.match(/Track import was not confirmed/g) || []).length).toBe(2);
  });
});
