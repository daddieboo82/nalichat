// Cross-platform microphone routing for browser-backed capture.
// A selected USB/Bluetooth/headset mic is only usable when the browser/OS
// exposes a stable deviceId. Never bypass a denied permission or claim all
// external devices are available on every mobile browser.
const MISSING_DEVICE_ERRORS = new Set([
  'NotFoundError', 'DevicesNotFoundError', 'OverconstrainedError',
  'ConstraintNotSatisfiedError',
]);

export function preferredMicrophoneId(storage) {
  try {
    const source = storage === undefined ? globalThis.localStorage : storage;
    const id = source?.getItem?.('audioInputDevice');
    return typeof id === 'string' && id && id !== 'default' ? id : null;
  } catch {
    return null;
  }
}

export const MICROPHONE_SELECTION_EVENT = 'nalichat:microphone-selection-changed';

export function microphoneConstraints(audio = true, deviceId = preferredMicrophoneId()) {
  if (!deviceId) return { audio };
  const settings = audio === true ? {} : { ...(audio || {}) };
  return { audio: { ...settings, deviceId: { exact: deviceId } } };
}

export async function openPreferredMicrophone(
  mediaDevices,
  { audio = true, video = false, deviceId = preferredMicrophoneId(), onFallback } = {},
) {
  if (!mediaDevices?.getUserMedia) throw new Error('This browser cannot access a microphone.');
  const requested = microphoneConstraints(audio, deviceId);
  try {
    return await mediaDevices.getUserMedia({ ...requested, video });
  } catch (error) {
    if (!deviceId || !MISSING_DEVICE_ERRORS.has(error?.name)) throw error;
    // The selected microphone was removed or is unavailable in this browser.
    // Try the OS default, without bypassing NotAllowedError or NotReadableError.
    onFallback?.(error);
    return mediaDevices.getUserMedia({ audio, video });
  }
}
