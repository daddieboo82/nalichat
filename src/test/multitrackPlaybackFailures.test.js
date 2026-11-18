import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('multitrack playback failures', () => {
  it('only enters playing state after at least one audible track starts', async () => {
    const s = await readFile('src/components/studio/MultiTrackEditor.jsx', 'utf8');
    expect(s).toContain('const handlePlay = async () => {');
    expect(s).toContain('if (!started.some(Boolean) && !futurePlayable)');
    expect(s).toContain("Couldn't start track playback. Please try again.");
    expect(s).toContain('if (attempts.length === 0 && !futurePlayable)');
    expect(s).toContain('const hasSoloTrack = tracks.some((track) => track.solo && !track.muted)');
    expect(s).toContain('sessionTrackLocalTime(track, sessionTime)');
    expect(s).toContain('const sessionTime = clock.from + (performance.now() - clock.startedAt) / 1000');
  });
});
