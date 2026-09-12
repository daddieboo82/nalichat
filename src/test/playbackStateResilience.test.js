// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('playback state resilience', () => {
  it('retries playlist playback when the selected track changes and clears false playing state', async () => {
    const source = await readText('src/pages/PlaylistDetail.jsx');
    expect(source).toContain('}, [isPlaying, currentTrack?.file_url]);');
    expect(source).toContain('if (!cancelled) setIsPlaying(false);');
    expect(source).toContain('}, [currentTrack?.id]);');
  });

  it('only shows the daily pick as playing after audio playback actually starts', async () => {
    const source = await readText('src/components/home/DailyRecommendation.jsx');
    expect(source).toContain('await player.play();');
    expect(source).toContain('setPlaying(true);');
    expect(source).toContain('player.onerror = () => setPlaying(false);');
    expect(source).toContain('audio.onerror = null;');
  });
});
