import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio track version pagination', () => {
  it('loads the complete version history in bounded pages', async () => {
    const s = await readFile('src/components/studio/TrackVersionHistory.jsx', 'utf8');
    expect(s).toContain('async function listAllTrackVersions(trackId)');
    expect(s).toContain('const pageSize = 200;');
    expect(s).toContain('for (let skip = 0; ; skip += pageSize)');
    expect(s).toContain('queryFn: () => listAllTrackVersions(track.id)');
    expect(s).not.toContain('"-version_number", 500');
  });
});
