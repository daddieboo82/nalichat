import { describe, expect, it } from 'vitest';
import { estimateSharedTrackSync, sampleSyncGuide } from './sessionSyncAssist';

function sourceAudio(length = 22000) {
  let seed = 0x534e4341;
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    samples[i] = ((seed / 4294967296) * 2 - 1) * .45;
  }
  return samples;
}
function shifted(reference, offsetMs, driftMs = 0) {
  return Float32Array.from(reference, (_, i) => {
    const offset = offsetMs + driftMs * i / reference.length;
    return reference[Math.round(i + offset)] || 0;
  });
}

describe('non-destructive cross-device session sync', () => {
  it('detects a matching reference guide and proposes an offset in milliseconds', () => {
    const guide = sourceAudio();
    const result = estimateSharedTrackSync({
      reference: guide,
      target: shifted(guide, 235),
      sampleRate: 1000,
    });
    expect(result.valid).toBe(true);
    expect(result.suggestedStart).toBeCloseTo(.235, 2);
    expect(result.confidence).toBeGreaterThan(.9);
    expect(Math.abs(result.driftMs)).toBeLessThan(5);
  });

  it('rejects unrelated singing rather than inventing an alignment', () => {
    const result = estimateSharedTrackSync({
      reference: sourceAudio(),
      target: Float32Array.from({length:22000}, (_, i) => Math.sin(i * 0.019) * .3),
      sampleRate: 1000,
    });
    expect(result.valid).toBe(false);
    expect(result).not.toHaveProperty('suggestedStart');
  });

  it('flags significant accumulated drift without trying to time-stretch source audio', () => {
    const guide = sourceAudio();
    const result = estimateSharedTrackSync({
      reference: guide,
      target: shifted(guide, 180, 100),
      sampleRate: 1000,
    });
    expect(result.valid).toBe(false);
    expect(result.driftDetected).toBe(true);
    expect(Math.abs(result.driftMs)).toBeGreaterThan(15);
  });

  it('refuses silent/short recordings and invalid input', () => {
    expect(estimateSharedTrackSync({reference:new Float32Array(10000),target:new Float32Array(10000)}).valid).toBe(false);
    expect(estimateSharedTrackSync({reference:new Float32Array(1000),target:new Float32Array(1000)}).valid).toBe(false);
    expect(estimateSharedTrackSync({reference:null,target:null}).valid).toBe(false);
  });

  it('samples browser-decoded PCM using actual sample rate rather than assuming 48 kHz', () => {
    const signal = Float32Array.from({length:44100 * 5}, (_,i) => Math.sin(i * Math.PI / 9));
    const result = sampleSyncGuide({
      sampleRate: 44100, numberOfChannels: 1,
      duration: 5, getChannelData: () => signal,
    });
    expect(result).toHaveLength(5000);
    expect(result.every(Number.isFinite)).toBe(true);
  });
});
