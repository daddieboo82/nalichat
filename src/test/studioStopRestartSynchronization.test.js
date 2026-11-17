import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { studioPlaybackPosition } from '../lib/studioPlaybackPosition.js';

describe('Studio stop and immediate restart synchronization', () => {
  it('resets transport synchronously and does not leave an asynchronous seek', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const from = source.indexOf('const stop = () => {');
    const to = source.indexOf('const handleCountInComplete =', from);
    const block = source.slice(from, to);
    expect(block).toContain('Object.values(audioElementsRef.current).forEach(a => a.pause())');
    expect(block).toContain('updateCurrentTime(0)');
    expect(block).toContain('playbackFailedRef.current.clear()');
    expect(block).not.toContain('setTimeout(');
    expect(block).not.toContain('a.currentTime = 0');
  });
  it('restarts a source-trimmed first clip at its actual source offset', () => {
    const first = { startTime: 0, duration: 4, clipStart: 8 };
    const second = { startTime: 4, duration: 6, clipStart: 12 };
    expect(studioPlaybackPosition(first, 0)).toEqual({ active: true, sourceTime: 8 });
    expect(studioPlaybackPosition(second, 0).active).toBe(false);
  });
});
