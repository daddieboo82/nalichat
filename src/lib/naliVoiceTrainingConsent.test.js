import { describe, expect, it, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({ consent: false }));
vi.mock('./naliVoiceModelStore', () => ({
  getPrivateNaliVoiceStatus: vi.fn(async () => ({ consent: state.consent })),
  updatePrivateNaliVoiceConsent: vi.fn(async enabled => {
    state.consent = enabled;
    return { success: true, consent: enabled };
  }),
}));

import {
  isPrivateVoiceTrainingEnabled, setPrivateVoiceTrainingEnabled, shouldTrainNaliVoiceTake,
} from './naliVoiceTrainingConsent';

describe('NaliVoice server-backed training consent', () => {
  beforeEach(() => { state.consent = false; });

  it('defaults off and requires an explicit server-side opt in', async () => {
    expect(await isPrivateVoiceTrainingEnabled('owner-a')).toBe(false);
    await setPrivateVoiceTrainingEnabled('owner-a', true);
    expect(await isPrivateVoiceTrainingEnabled('owner-a')).toBe(true);
    await setPrivateVoiceTrainingEnabled('owner-a', false);
    expect(await isPrivateVoiceTrainingEnabled('owner-a')).toBe(false);
  });

  it('requires authentication and allows only nonempty microphone captures', async () => {
    await expect(setPrivateVoiceTrainingEnabled('', true)).rejects.toThrow();
    const props = { optedIn: true, owner: 'owner-a', recordingBytes: 1024, hadMicrophoneTrack: true };
    expect(shouldTrainNaliVoiceTake(props)).toBe(true);
    expect(shouldTrainNaliVoiceTake({ ...props, optedIn: false })).toBe(false);
    expect(shouldTrainNaliVoiceTake({ ...props, owner: null })).toBe(false);
    expect(shouldTrainNaliVoiceTake({ ...props, recordingBytes: 0 })).toBe(false);
    expect(shouldTrainNaliVoiceTake({ ...props, hadMicrophoneTrack: false })).toBe(false);
  });
});
