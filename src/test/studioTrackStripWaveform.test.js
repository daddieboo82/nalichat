import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { studioTrackStripWaveformBars } from '../lib/studioTrackStripWaveform.js';

describe('Studio multitrack strip shows actual waveform measurements', () => {
  it('renders no fabricated signal for absent or silent audio', () => {
    expect(studioTrackStripWaveformBars([], 4)).toEqual([0, 0, 0, 0]);
    expect(studioTrackStripWaveformBars(null, 3)).toEqual([0, 0, 0]);
    expect(studioTrackStripWaveformBars([0, 0, 0, 0], 4)).toEqual([0, 0, 0, 0]);
  });
  it('shows measured peaks in the correct timeline buckets', () => {
    expect(studioTrackStripWaveformBars([0.1, 0.5, -0.8, 0], 2)).toEqual([0.5, 0.8]);
    expect(studioTrackStripWaveformBars([0, 1, 0, 0], 4)).toEqual([0, 1, 0, 0]);
  });
  it('clamps invalid amplitude and supports typed sample arrays', () => {
    expect(studioTrackStripWaveformBars(new Float32Array([0, 1.4]), 2)).toEqual([0, 1]);
    expect(studioTrackStripWaveformBars([NaN, Infinity, -0.4, 0], 2)).toEqual([0, 0.4]);
    expect(studioTrackStripWaveformBars([0.3], -1)).toEqual([]);
  });
  it('recomputes on waveform data changes instead of randomizing by track ID', async () => {
    const src = await readFile('src/components/studio/TrackStrip.jsx', 'utf8');
    expect(src).toContain('studioTrackStripWaveformBars(track.waveform), [track.waveform]');
    expect(src).toContain('Math.round(h * 32)');
    expect(src).not.toContain('Math.random()');
  });
});
