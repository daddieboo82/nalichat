import { describe, expect, it } from 'vitest';
import { appendStudioLiveWaveform, shouldRedrawStudioWaveform, STUDIO_LIVE_WAVEFORM_LIMIT } from './studioLiveWaveform';

describe('Studio live recording waveform rendering', () => {
  it('bounds the preview array and preserves peaks when compacting', () => {
    let values = [];
    for (let i = 0; i < 12000; i++) values = appendStudioLiveWaveform(values, i === 2000 ? 1 : 0);
    expect(values.length).toBeLessThanOrEqual(STUDIO_LIVE_WAVEFORM_LIMIT);
    expect(Math.max(...values)).toBe(1);
  });

  it('sanitizes invalid preview amplitudes without affecting captured audio', () => {
    let samples = appendStudioLiveWaveform([], NaN, 4);
    samples = appendStudioLiveWaveform(samples, -5, 4);
    samples = appendStudioLiveWaveform(samples, 8, 4);
    expect(samples).toEqual([0, 0, 1]);
  });

  it('draws at new timeline pixels and never redraws unchanged canvas frames', () => {
    const canvas = { width: 10, dataset: { studioWaveformSamples: '3' } };
    expect(shouldRedrawStudioWaveform(canvas, 10, 4)).toBe(false);
    expect(shouldRedrawStudioWaveform(canvas, 11, 4)).toBe(true);
    expect(shouldRedrawStudioWaveform({ width: 10, dataset: {} }, 10, 4)).toBe(true);
    expect(shouldRedrawStudioWaveform(canvas, 11, 1)).toBe(false);
  });
});
