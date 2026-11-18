// Private per-account NaliVoice training preferences. No collection of other
// people's voice recordings or shared-model contributions without agreement.
const prefix = 'nalivoice_private_training_optin_v1:';

export function isPrivateVoiceTrainingEnabled(owner, storage = globalThis.localStorage) {
  if (typeof owner !== 'string' || !owner || !storage) return false;
  try { return storage.getItem(prefix + owner) === 'yes'; } catch { return false; }
}

export function setPrivateVoiceTrainingEnabled(owner, enabled, storage = globalThis.localStorage) {
  if (typeof owner !== 'string' || !owner) throw new Error('A signed-in account is required.');
  if (!storage) throw new Error('Cannot store voice training preferences on this device.');
  if (enabled) storage.setItem(prefix + owner, 'yes');
  else storage.removeItem(prefix + owner);
}

// Explicit consent, only newly recorded microphone audio, and non-MIDI tracks.
export function shouldTrainNaliVoiceTake({ optedIn, owner, recordingBytes, hadMicrophoneTrack }) {
  return optedIn === true && typeof owner === 'string' && owner.length > 0 &&
    Number.isFinite(recordingBytes) && recordingBytes > 0 && hadMicrophoneTrack === true;
}
