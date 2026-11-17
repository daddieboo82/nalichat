import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { studioClipAudioRange } from '../lib/studioClipAudioRange.js';

describe('Studio offline export clip source ranges', () => {
  it('renders only each half of a split source at the correct timeline positions', () => {
    expect(studioClipAudioRange({ startTime: 0, clipStart: 0, duration: 5 }, 10))
      .toEqual({ when: 0, offset: 0, duration: 5, endsAt: 5 });
    expect(studioClipAudioRange({ startTime: 5, clipStart: 5, duration: 5 }, 10))
      .toEqual({ when: 5, offset: 5, duration: 5, endsAt: 10 });
  });
  it('clamps the duration at the source end and respects trimmed clips', () => {
    expect(studioClipAudioRange({ startTime: 12, clipStart: 8, duration: 7 }, 10))
      .toEqual({ when: 12, offset: 8, duration: 2, endsAt: 14 });
    expect(studioClipAudioRange({ startTime: 3, clipStart: 2 }, 10)?.duration).toBe(8);
  });
  it('rejects nonexistent and invalid source ranges', () => {
    for (const track of [
      { clipStart: 11, duration: 2 }, { clipStart: -1, duration: 2 },
      { clipStart: 1, duration: -3 }, { startTime: -2, duration: 3 },
      { clipStart: 5, duration: 0 }, { startTime: NaN, duration: 2 },
    ]) expect(studioClipAudioRange(track, 10)).toBeNull();
  });
  it('passes offset and duration to the actual offline audio buffer source', async () => {
    const source = await readFile('src/lib/audioProcessing.js', 'utf8');
    expect(source).toContain('studioClipAudioRange(t, buffer.duration)');
    expect(source).toContain('d.range.endsAt');
    expect(source).toContain('src.start(range.when, range.offset, range.duration)');
    expect(source).not.toContain('src.start(Math.max(0, track.startTime || 0))');
  });
});
