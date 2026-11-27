import { describe, expect, it } from 'vitest';
import { studioPlaybackTimeAfterStall } from './studioPlaybackClock';

const clip = { id: 8, audioUrl: 'blob:lead', startTime: 30, clipStart: 5, duration: 120 };
const playing = (currentTime, extra = {}) => ({
  paused: false, ended: false, seeking: false, currentTime,
  dataset: { srcUrl: 'blob:lead' }, ...extra,
});

describe('Studio playback resynchronization after a stalled animation frame', () => {
  it('uses actual media progression to correct a long RAF stall', () => {
    expect(studioPlaybackTimeAfterStall({
      expectedTime: 50.25, frameGapSeconds: 8,
      tracks: [clip], elements: { 8: playing(33) },
    })).toBe(58); // 30 + 33 - 5
  });

  it('respects split clip source offsets, not raw audio currentTime', () => {
    expect(studioPlaybackTimeAfterStall({
      expectedTime: 31.25, frameGapSeconds: 4,
      tracks: [clip], elements: { 8: playing(9) },
    })).toBe(34);
  });

  it('does not re-anchor to paused, ended, stale or inaudible media', () => {
    const base = { expectedTime: 50.25, frameGapSeconds: 8, tracks: [clip] };
    expect(studioPlaybackTimeAfterStall({ ...base, elements: { 8: playing(33, { paused: true }) } })).toBe(50.25);
    expect(studioPlaybackTimeAfterStall({ ...base, elements: { 8: playing(33, { ended: true }) } })).toBe(50.25);
    expect(studioPlaybackTimeAfterStall({ ...base, elements: { 8: playing(33, { seeking: true }) } })).toBe(50.25);
    expect(studioPlaybackTimeAfterStall({ ...base, elements: { 8: playing(33, { dataset: { srcUrl: 'blob:old' } }) } })).toBe(50.25);
    expect(studioPlaybackTimeAfterStall({ ...base, tracks: [{ ...clip, muted: true }], elements: { 8: playing(33) } })).toBe(50.25);
    expect(studioPlaybackTimeAfterStall({ ...base, tracks: [clip, { id: 9, solo: true }], elements: { 8: playing(33) } })).toBe(50.25);
  });

  it('ignores impossible positions and preserves fallback on a paused browser', () => {
    const base = { expectedTime: 50.25, frameGapSeconds: 8, tracks: [clip] };
    expect(studioPlaybackTimeAfterStall({ ...base, elements: { 8: playing(100) } })).toBe(50.25);
    expect(studioPlaybackTimeAfterStall({ ...base, elements: { 8: playing(10) } })).toBe(50.25);
    expect(studioPlaybackTimeAfterStall({ ...base, elements: { 8: playing(NaN) } })).toBe(50.25);
    expect(studioPlaybackTimeAfterStall({ ...base, elements: { 8: playing(33) }, frameGapSeconds: 0.016 })).toBe(50.25);
    expect(studioPlaybackTimeAfterStall({ ...base, elements: { 8: playing(33) }, recording: true })).toBe(50.25);
  });
});
