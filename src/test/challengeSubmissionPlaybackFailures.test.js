import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('challenge submission playback failures', () => {
  it('does not enter playing state when audio.play rejects', async () => {
    const card = await readFile('src/components/challenges/SubmissionCard.jsx', 'utf8');
    const player = await readFile('src/pages/SubmissionPlayer.jsx', 'utf8');
    for (const s of [card, player]) {
      expect(s).toContain('await audioRef.current.play();');
      expect(s).toContain('setPlaying(false);');
      expect(s).toContain("Couldn't play this remix. Please try again.");
    }
  });
});
