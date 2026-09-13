import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('media playback rejection handling', () => {
  it('surfaces rejected playback across recordings, comments, and Studio versions', async () => {
    const record = await readFile('src/pages/Record.jsx', 'utf8');
    const comments = await readFile('src/components/explore/TrackCommentsDialog.jsx', 'utf8');
    const versions = await readFile('src/components/studio/TrackVersionHistory.jsx', 'utf8');
    expect(record).toContain("Couldn't play this recording. Please try again.");
    expect(comments).toContain("Couldn't play this track. Please try again.");
    expect(comments).toContain("Couldn't play from that timestamp. Please try again.");
    expect(versions).toContain("Couldn't preview this version. Please try again.");
  });
});
