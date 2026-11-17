import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { cutStudioClipAtPointer } from '../lib/studioClipCut';

const clip = Object.freeze({ id: 7, name: 'Guitar', startTime: 3, clipStart: 2, duration: 10, fullDuration: 20, audioUrl: 'track.wav', waveform: [0.2, 0.5] });

describe('Studio destructive Cut tool', () => {
  it('removes the left side in place and preserves source alignment', () => {
    const x = cutStudioClipAtPointer(clip, .2);
    expect(x).toMatchObject({ changed: true, side: 'left', cutTime: 5 });
    expect(x.clip).toMatchObject({ id: 7, startTime: 5, clipStart: 4, duration: 8, fullDuration: 20, audioUrl: 'track.wav' });
    expect(clip.startTime).toBe(3);
  });
  it('removes the right side in place and keeps the original source offset', () => {
    const x = cutStudioClipAtPointer(clip, .8);
    expect(x).toMatchObject({ changed: true, side: 'right', cutTime: 11 });
    expect(x.clip).toMatchObject({ id: 7, startTime: 3, clipStart: 2, duration: 8 });
  });
  it('does not change clips at invalid or boundary click positions', () => {
    for (const fraction of [NaN, Infinity, 0, 1]) {
      const x = cutStudioClipAtPointer(clip, fraction);
      expect(x.changed).toBe(false);
      expect(x.clip).toBe(clip);
    }
  });
  it('handles an already trimmed clip without altering its original source URL', () => {
    const earlier = cutStudioClipAtPointer(clip, .25).clip;
    const x = cutStudioClipAtPointer(earlier, .75);
    expect(x.clip).toMatchObject({ id: 7, startTime: 5.5, clipStart: 4.5, duration: 5.625, audioUrl: 'track.wav' });
  });
  it('wires the tool to one-track history updates with no new track allocation', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const start = source.indexOf("if (activeTool === 'cut') {", source.indexOf('onPointerDown={(e) => {'));
    const end = source.indexOf("if (activeTool === 'scrub') {", start);
    const block = source.slice(start,end);
    expect(block).toContain('cutStudioClipAtPointer(track, ratio)');
    expect(block).toContain('prev.map(t => t.id === track.id ? result.clip : t)');
    expect(block).not.toContain('nextTrackId(');
    expect(block).not.toContain('rightClip');
  });
});
