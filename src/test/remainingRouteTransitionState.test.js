// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('remaining route transition state', () => {
  it('ignores stale squad invite loads', async () => {
    const source = await readText('src/pages/SquadJoin.jsx');
    expect(source).toContain('const loadRequestRef = useRef(0);');
    expect(source).toContain('const requestId = ++loadRequestRef.current;');
    expect(source).toContain('if (requestId !== loadRequestRef.current) return;');
    expect(source).toContain('setSquad(null);');
  });

  it('keeps the playlist player index valid across playlist/track changes', async () => {
    const source = await readText('src/pages/PlaylistDetail.jsx');
    expect(source).toContain('setCurrentTrackIndex(0);');
    expect(source).toContain('tracks.length === 0 ? 0 : Math.min(index, tracks.length - 1)');
    expect(source).toContain('}, [playlistId]);');
    expect(source).toContain('}, [tracks.length]);');
  });
});
