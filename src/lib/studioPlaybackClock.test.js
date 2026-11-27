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

  it('requires agreeing active tracks rather than trusting the first audio element', () => {
    const bass = { ...clip, id: 9, audioUrl: 'blob:bass' };
    const base = { expectedTime: 50.25, frameGapSeconds: 8, tracks: [clip, bass] };
    const lead = playing(33); // timeline 58
    const bassAudio = (time) => playing(time, { dataset: { srcUrl: 'blob:bass' } });
    expect(studioPlaybackTimeAfterStall({
      ...base, elements: { 8: lead, 9: bassAudio(33.1) },
    })).toBeCloseTo(58.05);
    // Even a seemingly valid track is not enough if the other audible track
    // reports a different timeline position.
    expect(studioPlaybackTimeAfterStall({
      ...base, elements: { 8: lead, 9: bassAudio(30) },
    })).toBe(50.25);
    expect(studioPlaybackTimeAfterStall({
      ...base, tracks: [bass, clip], elements: { 8: lead, 9: bassAudio(30) },
    })).toBe(50.25);
  });

  it('refuses to resynchronize if another current playing track is outside the possible frame window', () => {
    const bass = { ...clip, id: 9, audioUrl: 'blob:bass' };
    const base = { expectedTime: 50.25, frameGapSeconds: 8, tracks: [clip, bass] };
    const lead = playing(33); // timeline 58, valid
    const bassAudio = time => playing(time, { dataset: { srcUrl: 'blob:bass' } });
    // A valid lead should not override an implausibly ahead bass.
    expect(studioPlaybackTimeAfterStall({
      ...base, elements: { 8: lead, 9: bassAudio(100) },
    })).toBe(50.25);
    // Nor should it override a bass positioned well behind the last playhead.
    expect(studioPlaybackTimeAfterStall({
      ...base, elements: { 8: lead, 9: bassAudio(10) },
    })).toBe(50.25);
    // A paused bass provides no conflicting playback clock.
    expect(studioPlaybackTimeAfterStall({
      ...base, elements: { 8: lead, 9: bassAudio(10), },
      tracks: [clip, { ...bass, muted: true }],
    })).toBe(58);
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
