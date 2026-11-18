import { describe, expect, it } from 'vitest';
import { analyzeStudioCaptureQuality } from './studioCaptureQuality';
import { applyStudioRecordedTake } from './studioRecordingTake';

const capture = (samples, rate = 48000) => ({
  numberOfChannels: 1,
  length: samples.length,
  sampleRate: rate,
  getChannelData: () => samples,
});

describe('portable Studio microphone quality verification', () => {
  it('identifies clipped audio without touching the source', () => {
    const samples = new Float32Array(48000).fill(0.5);
    samples.fill(1, 0, 1000);
    const result = analyzeStudioCaptureQuality(capture(samples));
    expect(result.status).toBe('clipping');
    expect(result.clippingRatio).toBeGreaterThan(0.001);
    expect(samples[0]).toBe(1);
  });

  it('flags quiet, silent and normally leveled recordings', () => {
    expect(analyzeStudioCaptureQuality(capture(new Float32Array(1000))).status).toBe('silent');
    expect(analyzeStudioCaptureQuality(capture(new Float32Array(1000).fill(0.003))).status).toBe('quiet');
    expect(analyzeStudioCaptureQuality(capture(new Float32Array(1000).fill(0.15))).status).toBe('good');
  });

  it('includes measured level and sample rate in new microphone take metadata', () => {
    const quality = analyzeStudioCaptureQuality(capture(new Float32Array(1000).fill(0.15), 44100));
    const tracks = [{ id: 1, name: 'Lead Voice', type: 'audio', armed: true }];
    const result = applyStudioRecordedTake(tracks, {
      audioUrl: 'blob:take', waveform: [0.5], startTime: 3, duration: 4,
      nextId: 4, captureQuality: quality,
    });
    expect(result[0].captureQuality.sampleRate).toBe(44100);
    expect(result[0].captureQuality.status).toBe('good');
    expect(tracks[0]).not.toHaveProperty('captureQuality');
  });

  it('handles malformed buffers without claiming a clean recording', () => {
    expect(analyzeStudioCaptureQuality(null).status).toBe('unavailable');
    expect(analyzeStudioCaptureQuality(capture(new Float32Array(0))).status).toBe('unavailable');
  });
});
