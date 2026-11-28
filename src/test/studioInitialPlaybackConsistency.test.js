import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { studioPlaybackPosition } from '../lib/studioPlaybackPosition';

describe('Studio first Play uses same source and mute/solo rules as split transport', () => {
  it('seeks to the source offset and excludes audio outside the current clip', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const toggle = source.slice(source.indexOf('const togglePlay = async'), source.indexOf('useEffect(() => {', source.indexOf('const togglePlay = async')));
    expect(toggle).toContain('studioPlaybackPosition(track, currentTimeRef.current)');
    expect(toggle).toContain('const audible = !track.muted && (!hasSolo || track.solo)');
    expect(toggle).toContain('audio.currentTime = position.sourceTime');
    expect(toggle).not.toContain('audio.currentTime = clipStartOffset');
  });
  it('maps first-play source offsets at the split boundary without overlap', () => {
    const left = { startTime: 0, duration: 4, clipStart: 1 };
    const right = { startTime: 4, duration: 3, clipStart: 5 };
    expect(studioPlaybackPosition(left, 4).active).toBe(false);
    expect(studioPlaybackPosition(right, 4).sourceTime).toBe(5);
  });
});
