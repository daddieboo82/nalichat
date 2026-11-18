// Consent is saved with the authenticated account on the server, not in
// localStorage. New microphone recordings never train by default.
import { getPrivateNaliVoiceStatus, updatePrivateNaliVoiceConsent } from './naliVoiceModelStore';

export async function isPrivateVoiceTrainingEnabled(owner) {
  if (!owner) return false;
  const status = await getPrivateNaliVoiceStatus();
  return status.consent === true;
}

export async function setPrivateVoiceTrainingEnabled(owner, enabled) {
  if (!owner) throw new Error('A signed-in account is required.');
  return updatePrivateNaliVoiceConsent(enabled);
}

export function shouldTrainNaliVoiceTake({ optedIn, owner, recordingBytes, hadMicrophoneTrack }) {
  return optedIn === true && typeof owner === 'string' && owner.length > 0 &&
    Number.isFinite(recordingBytes) && recordingBytes > 0 && hadMicrophoneTrack === true;
}
