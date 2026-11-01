import { describe, it, expect } from 'vitest';
import {
  trackGainValue,
  clampAudioElementVolume,
  getTrackRenderRegions,
  getTrackTimelineFade,
  getClipRegionEnvelope,
  trackPanValue,
  countActiveEffects,
  getTrackEffects,
  FX_CHAIN_ORDER,
} from '@/lib/audioProcessing';

describe('offline clip-region render scheduling', () => {
  it('keeps split regions on one track with contiguous source offsets', () => {
    const regions = getTrackRenderRegions({
      id: 'track-1',
      clipRegions: [
        { id: 'left', timelineStart: 0, sourceStart: 0, sourceEnd: 4 },
        { id: 'right', timelineStart: 4, sourceStart: 4, sourceEnd: 10 },
      ],
    }, 10);
    expect(regions.map(region => [region.timelineStart, region.sourceStart, region.sourceEnd])).toEqual([
      [0, 0, 4],
      [4, 4, 10],
    ]);
  });

  it('preserves cut gaps instead of rendering removed source audio', () => {
    const regions = getTrackRenderRegions({
      id: 'track-1',
      clipRegions: [
        { id: 'before', timelineStart: 0, sourceStart: 0, sourceEnd: 3 },
        { id: 'after', timelineStart: 7, sourceStart: 7, sourceEnd: 10 },
      ],
    }, 10);
    expect(regions.map(region => [region.timelineStart, region.sourceStart, region.sourceEnd])).toEqual([
      [0, 0, 3],
      [7, 7, 10],
    ]);
    expect(regions.every(region => region.timelineStart !== 3)).toBe(true);
  });

  it('clips source ranges to the decoded audio duration', () => {
    const regions = getTrackRenderRegions({
      id: 'track-1',
      clipRegions: [{ id: 'tail', timelineStart: 2, sourceStart: 8, sourceEnd: 12 }],
    }, 10);
    expect(regions).toHaveLength(1);
    expect(regions[0]).toMatchObject({ timelineStart: 2, sourceStart: 8, sourceEnd: 10 });
  });
});

describe('track-wide offline fade envelope', () => {
  it('maps fade fractions across the full clip-region timeline span', () => {
    const envelope = getTrackTimelineFade(
      { fadeIn: 0.2, fadeOut: 0.25 },
      [
        { timelineStart: 3, sourceStart: 0, sourceEnd: 4 },
        { timelineStart: 9, sourceStart: 5, sourceEnd: 8 },
      ],
    );
    expect(envelope).toEqual({ start: 3, end: 12, fadeIn: 1.8, fadeOut: 1.8 });
  });

  it('prevents fade durations from overlapping beyond the arrangement span', () => {
    const envelope = getTrackTimelineFade(
      { fadeIn: 0.8, fadeOut: 0.8 },
      [{ timelineStart: 2, sourceStart: 0, sourceEnd: 5 }],
    );
    expect(envelope.fadeIn).toBe(4);
    expect(envelope.fadeOut).toBe(1);
  });
});

describe('clip-region render envelopes', () => {
  it('converts clip gain from dB and retains region fades', () => {
    const envelope = getClipRegionEnvelope({
      sourceStart: 2,
      sourceEnd: 6,
      gainDb: 6,
      fadeIn: 0.5,
      fadeOut: 1,
    });
    expect(envelope.gain).toBeCloseTo(Math.pow(10, 6 / 20));
    expect(envelope.fadeIn).toBe(0.5);
    expect(envelope.fadeOut).toBe(1);
  });

  it('bounds fades to the region duration and limits extreme gain', () => {
    const envelope = getClipRegionEnvelope({
      sourceStart: 0,
      sourceEnd: 1,
      gainDb: 100,
      fadeIn: 0.8,
      fadeOut: 0.8,
    });
    expect(envelope.gain).toBeCloseTo(Math.pow(10, 24 / 20));
    expect(envelope.fadeIn).toBe(0.8);
    expect(envelope.fadeOut).toBeCloseTo(0.2);
  });
});

describe('HTML audio fallback volume', () => {
  it('clamps boosted and negative levels to the media element range', () => {
    expect(clampAudioElementVolume(1.5)).toBe(1);
    expect(clampAudioElementVolume(-0.25)).toBe(0);
    expect(clampAudioElementVolume(0.65)).toBe(0.65);
  });

  it('returns silence for non-finite levels', () => {
    expect(clampAudioElementVolume(Number.NaN)).toBe(0);
    expect(clampAudioElementVolume(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

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
