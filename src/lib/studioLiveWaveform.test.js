import { describe, expect, it } from 'vitest';
import {
  appendStudioLiveWaveform, shouldRedrawStudioWaveform,
  studioLiveCanvasWidth, studioLiveWaveformX, STUDIO_LIVE_WAVEFORM_LIMIT,
} from './studioLiveWaveform';

describe('Studio live recording waveform rendering', () => {
  it('bounds preview history while preserving peaks and their approximate elapsed position', () => {
    let values = [];
    for (let i = 0; i < 12000; i++) values = appendStudioLiveWaveform(values, i === 2000 ? 1 : 0, i / 60);
    expect(values.length).toBeLessThanOrEqual(STUDIO_LIVE_WAVEFORM_LIMIT);
    const peak = values.find(point => point.peak === 1);
    expect(peak).toBeDefined();
    expect(peak.time).toBeGreaterThanOrEqual(2000 / 60);
    expect(peak.time).toBeLessThan(2400 / 60);
    expect(studioLiveWaveformX(peak.time, 12000 / 60, 4000)).toBeGreaterThan(650);
    expect(studioLiveWaveformX(peak.time, 12000 / 60, 4000)).toBeLessThan(800);
  });

  it('sanitizes invalid amplitudes without modifying recorded PCM', () => {
    let samples = appendStudioLiveWaveform([], NaN, 0, 4);
    samples = appendStudioLiveWaveform(samples, -5, 1, 4);
    samples = appendStudioLiveWaveform(samples, 8, 2, 4);
    expect(samples).toEqual([{ time: 0, peak: 0 }, { time: 1, peak: 0 }, { time: 2, peak: 1 }]);
  });

  it('caps canvas backing width for long takes but keeps drawing after the cap', () => {
    expect(studioLiveCanvasWidth(0)).toBe(0);
    expect(studioLiveCanvasWidth(10.2)).toBe(11);
    expect(studioLiveCanvasWidth(900000)).toBe(4096);
    const canvas = { width: 4096, dataset: { studioWaveformSamples: '4000', studioWaveformLastDrawMs: '1000' } };
    expect(shouldRedrawStudioWaveform(canvas, 4096, 4001, 1050)).toBe(false);
    expect(shouldRedrawStudioWaveform(canvas, 4096, 4001, 1101)).toBe(true);
    expect(shouldRedrawStudioWaveform(canvas, 4095, 4001, 1050)).toBe(true);
    expect(shouldRedrawStudioWaveform(canvas, 4096, 1, 1101)).toBe(false);
  });

  it('maps peaks by elapsed time after compaction rather than array index', () => {
    expect(studioLiveWaveformX(2, 10, 100)).toBe(20);
    expect(studioLiveWaveformX(8, 10, 100)).toBe(80);
    expect(studioLiveWaveformX(20, 10, 100)).toBe(100);
    expect(studioLiveWaveformX(-1, 10, 100)).toBe(0);
    expect(studioLiveWaveformX(3, 0, 100)).toBe(0);
  });
});
