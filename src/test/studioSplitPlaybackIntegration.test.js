import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { studioPlaybackPosition } from '../lib/studioPlaybackPosition.js';

describe('Studio transport follows split clip boundaries', () => {
  it('starts a newly active split clip and pauses inactive media within RAF', async () => {
    const studio = await readFile('src/pages/Studio.jsx','utf8');
    const raf = studio.slice(studio.indexOf('const updateTime = (time) => {'), studio.indexOf('animationFrameId = requestAnimationFrame(updateTime);'));
    expect(raf).toContain('studioPlaybackPosition(track, newTime)');
    expect(raf).toContain('getTrackAudioRef.current?.(track)');
    expect(raf).toContain('candidate.currentTime = position.sourceTime');
    expect(raf).toContain('Promise.resolve(candidate.play())');
    expect(raf).toContain('if (audio && !audio.paused) audio.pause()');
    expect(raf).toContain('playbackStartingRef.current.has(track.id)');
    expect(raf).toContain('playbackFailedRef.current.has(track.id)');
  });

  it('seeks using source offset instead of timeline seconds', async () => {
    const studio = await readFile('src/pages/Studio.jsx','utf8');
    const seek = studio.slice(studio.indexOf('const updateCurrentTime = (newTime) => {'), studio.indexOf('const togglePlay = () => {'));
    expect(seek).toContain('studioPlaybackPosition(track, newTime)');
    expect(seek).toContain('audio.currentTime = position.sourceTime');
    expect(seek).not.toContain('audio.currentTime = newTime');
  });

  it('ensures only the correct region is playing across adjacent split boundaries', () => {
    const clips = [
      { id: 1, startTime: 0, duration: 2, clipStart: 8 },
      { id: 2, startTime: 2, duration: 3, clipStart: 10 },
    ];
    const before = clips.map(x => studioPlaybackPosition(x,1.99));
    const after = clips.map(x => studioPlaybackPosition(x,2));
    expect(before.map(x => x.active)).toEqual([true,false]);
    expect(after.map(x => x.active)).toEqual([false,true]);
    expect(after[1].sourceTime).toBe(10);
  });
});
