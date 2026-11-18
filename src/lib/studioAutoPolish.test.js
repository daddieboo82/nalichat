import { describe, expect, it } from 'vitest';
import { isAutoPolishVocalTrack, setVocalAutoPolish } from './studioAutoPolish';

describe('Studio Auto Polish all vocals', () => {
  const tracks = [
    { id: 1, name: 'Lead Vocal.wav', type: 'audio', audioUrl: 'blob:one' },
    { id: 2, name: 'Main Beat.mp3', type: 'audio', audioUrl: 'blob:two' },
    { id: 3, name: 'Background Vox', type: 'audio', audioUrl: 'blob:three' },
    { id: 4, name: 'Keyboard', type: 'instrument', instrument: 'piano' },
    { id: 5, name: 'New Track 5', type: 'audio', recordedFromMicrophone: true },
    { id: 6, name: 'Rap Take', type: 'audio' },
    { id: 7, name: 'Vocal Folder', trackType: 'folder' },
  ];

  it('detects vocals without applying effects to beats or MIDI', () => {
    expect(tracks.map(isAutoPolishVocalTrack)).toEqual([true, false, true, false, true, true, false]);
  });

  it('enables Auto Polish for all matching tracks without mutating originals', () => {
    const enabled = setVocalAutoPolish(tracks, true);
    expect(enabled).not.toBe(tracks);
    expect(enabled.map(track => !!track.autoPolish)).toEqual([true, false, true, false, true, true, false]);
    expect(tracks[0].autoPolish).toBeUndefined();
  });

  it('switches off cleanly and returns the unmodified array on no-op', () => {
    const enabled = setVocalAutoPolish(tracks, true);
    expect(setVocalAutoPolish(enabled, true)).toBe(enabled);
    const disabled = setVocalAutoPolish(enabled, false);
    expect(disabled.every(track => !track.autoPolish)).toBe(true);
    expect(setVocalAutoPolish(disabled, false)).toBe(disabled);
  });

  it('automatically includes a newly recorded microphone take', () => {
    const enabled = setVocalAutoPolish(tracks, true);
    const extended = [...enabled, { id: 9, name: 'New Take', recordedFromMicrophone: true }];
    const next = setVocalAutoPolish(extended, true);
    expect(next.at(-1).autoPolish).toBe(true);
  });

  it('does not mistake an instrument called Vocal Synth for a vocal', () => {
    expect(isAutoPolishVocalTrack({ type: 'midi', name: 'Vocal Synth', instrument: 'synth' })).toBe(false);
  });
});
