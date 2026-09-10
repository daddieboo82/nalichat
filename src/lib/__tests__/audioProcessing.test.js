import { describe, it, expect } from 'vitest';
import {
  trackGainValue,
  trackPanValue,
  countActiveEffects,
  getTrackEffects,
  FX_CHAIN_ORDER,
} from '@/lib/audioProcessing';

describe('trackGainValue', () => {
  it('maps the 0-100 fader onto 0-1', () => {
    expect(trackGainValue({ volume: 100 })).toBeCloseTo(1);
    expect(trackGainValue({ volume: 50 })).toBeCloseTo(0.5);
    expect(trackGainValue({ volume: 0 })).toBeCloseTo(0);
  });

  it('defaults to 75% when no volume is set', () => {
    expect(trackGainValue({})).toBeCloseTo(0.75);
  });

  it('applies clip gain in dB on top of the fader', () => {
    // +6 dB is a little over 2x linear.
    expect(trackGainValue({ volume: 50, clipGain: 6 })).toBeCloseTo(0.5 * Math.pow(10, 6 / 20));
  });

  it('clamps junk input instead of producing NaN', () => {
    expect(Number.isFinite(trackGainValue({ volume: 'loud' }))).toBe(true);
    expect(Number.isFinite(trackGainValue({ volume: 999 }))).toBe(true);
    expect(Number.isFinite(trackGainValue({ volume: -50 }))).toBe(true);
    expect(trackGainValue({ volume: 999 })).toBeCloseTo(1);
    expect(trackGainValue({ volume: -50 })).toBeCloseTo(0);
  });
});

describe('trackPanValue', () => {
  it('maps the 0-100 pan control onto StereoPanner -1..1', () => {
    expect(trackPanValue({ pan: 0 })).toBeCloseTo(-1);
    expect(trackPanValue({ pan: 50 })).toBeCloseTo(0);
    expect(trackPanValue({ pan: 100 })).toBeCloseTo(1);
    expect(trackPanValue({ pan: 25 })).toBeCloseTo(-0.5);
  });

  it('defaults to centre', () => {
    expect(trackPanValue({})).toBe(0);
    expect(trackPanValue(undefined)).toBe(0);
  });

  it('clamps out-of-range values', () => {
    expect(trackPanValue({ pan: 500 })).toBeCloseTo(1);
    expect(trackPanValue({ pan: -500 })).toBeCloseTo(-1);
  });
});

describe('getTrackEffects', () => {
  it('reads either the legacy effects field or plugins', () => {
    expect(getTrackEffects({ plugins: { eq: {} } })).toEqual({ eq: {} });
    expect(getTrackEffects({ effects: { comp: {} } })).toEqual({ comp: {} });
    expect(getTrackEffects({})).toEqual({});
    expect(getTrackEffects(null)).toEqual({});
  });
});

describe('countActiveEffects', () => {
  it('counts only inserts that are switched on', () => {
    expect(countActiveEffects({ eq: { enabled: true }, comp: { enabled: false } })).toBe(1);
    // An insert with no explicit enabled flag is treated as on.
    expect(countActiveEffects({ delay: {} })).toBe(1);
  });

  it('returns zero for an empty or missing chain', () => {
    expect(countActiveEffects({})).toBe(0);
    expect(countActiveEffects(null)).toBe(0);
    expect(countActiveEffects(undefined)).toBe(0);
  });

  it('never counts more than the known chain slots', () => {
    const all = Object.fromEntries(FX_CHAIN_ORDER.map(id => [id, { enabled: true }]));
    expect(countActiveEffects({ ...all, bogusPlugin: { enabled: true } })).toBe(FX_CHAIN_ORDER.length);
  });
});
