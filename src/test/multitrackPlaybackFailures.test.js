import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('multitrack playback failures', () => {
  it('only enters playing state after at least one audible track starts', async () => {
    const s = await readFile('src/components/studio/MultiTrackEditor.jsx', 'utf8');
    expect(s).toContain('const handlePlay = async () => {');
    expect(s).toContain('if (!started.some(Boolean))');
    expect(s).toContain("Couldn't start track playback. Please try again.");
  });
});
