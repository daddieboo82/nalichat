import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('editor and custom player playback failures', () => {
  it('does not show playing state after rejected playback', async () => {
    const editor = await readFile('src/pages/StudioEditor.jsx', 'utf8');
    const player = await readFile('src/components/audio/CustomMediaPlayer.jsx', 'utf8');
    expect(editor).toContain("Couldn't preview this audio. Please try again.");
    expect(player).toContain("Couldn't play this audio. Please try again.");
    expect(player).toContain('await audioRef.current.play();');
  });
});
