// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('Studio track user-scoped caches', () => {
  it('isolates track comments and versions by authenticated user', async () => {
    const strip = await readText('src/components/studio/TrackStrip.jsx');
    const versions = await readText('src/components/studio/TrackVersionHistory.jsx');

    expect(strip).toContain('queryKey: ["trackComments", currentUser?.id, track.id]');
    expect(strip).toContain('enabled: !!currentUser?.id && !!track?.id');
    expect(versions).toContain('queryKey: ["track-versions", currentUser?.id, track?.id]');
    expect(versions).toContain('enabled: !!currentUser?.id && !!track?.id && open');
  });
});
