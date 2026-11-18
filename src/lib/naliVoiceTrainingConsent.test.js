import { describe, expect, it } from 'vitest';
import {
  isPrivateVoiceTrainingEnabled, setPrivateVoiceTrainingEnabled, shouldTrainNaliVoiceTake,
} from './naliVoiceTrainingConsent';

function memoryStorage() {
  const entries = new Map();
  return {
    getItem(key) { return entries.get(key) ?? null; },
    setItem(key, value) { entries.set(key, value); },
    removeItem(key) { entries.delete(key); },
  };
}

describe('NaliVoice personal training consent', () => {
  it('is always off before explicit opt-in, and is account-scoped', () => {
    const storage = memoryStorage();
    expect(isPrivateVoiceTrainingEnabled('owner-a', storage)).toBe(false);
    setPrivateVoiceTrainingEnabled('owner-a', true, storage);
    expect(isPrivateVoiceTrainingEnabled('owner-a', storage)).toBe(true);
    expect(isPrivateVoiceTrainingEnabled('owner-b', storage)).toBe(false);
    setPrivateVoiceTrainingEnabled('owner-a', false, storage);
    expect(isPrivateVoiceTrainingEnabled('owner-a', storage)).toBe(false);
  });

  it('rejects unknown accounts, MIDI-only recordings and empty microphone takes', () => {
    const props = { optedIn: true, owner: 'owner-a', recordingBytes: 1024, hadMicrophoneTrack: true };
    expect(shouldTrainNaliVoiceTake(props)).toBe(true);
    expect(shouldTrainNaliVoiceTake({ ...props, optedIn: false })).toBe(false);
    expect(shouldTrainNaliVoiceTake({ ...props, owner: null })).toBe(false);
    expect(shouldTrainNaliVoiceTake({ ...props, recordingBytes: 0 })).toBe(false);
    expect(shouldTrainNaliVoiceTake({ ...props, hadMicrophoneTrack: false })).toBe(false);
  });
});
