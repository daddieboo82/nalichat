import { openPreferredMicrophone, preferredMicrophoneId } from './microphoneCapture';

// Shared Studio microphone negotiation for Android, iOS and desktop.
// Every browser can ignore ideal constraints; never claim hardware-level
// quality or a lossless recording based only on the requested settings.
export const sharedStudioCaptureConstraints = Object.freeze({
  audio: {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: { ideal: 1 },
    sampleRate: { ideal: 48000 },
  },
});

// Overconstrained and unsupported optional properties must never prevent
// a user from recording on their built-in microphone.
export async function openStudioMicrophone(mediaDevices, constraints = sharedStudioCaptureConstraints) {
  if (!mediaDevices?.getUserMedia) throw new Error('This browser cannot access a microphone.');
  const deviceId = preferredMicrophoneId();
  const request = (audio) => deviceId
    ? openPreferredMicrophone(mediaDevices, { audio, deviceId })
    : mediaDevices.getUserMedia({ audio });
  try {
    return await request(constraints.audio);
  } catch (error) {
    if (!['OverconstrainedError', 'ConstraintNotSatisfiedError', 'TypeError'].includes(error?.name)) {
      throw error; // No retry after an explicit permission denial.
    }
    // Keep the anti-call-processing flags when possible but drop ideal
    // sample-rate/channel requests unsupported by some mobile browsers.
    try {
      return await request({ echoCancellation: false, noiseSuppression: false, autoGainControl: false });
    } catch (fallbackError) {
      if (!['OverconstrainedError', 'ConstraintNotSatisfiedError', 'TypeError'].includes(fallbackError?.name)) throw fallbackError;
      return request(true);
    }
  }
}

export function inspectSharedStudioCaptureSettings(settings) {
  if (!settings || typeof settings !== 'object') {
    return { processingEnabled: false, actualSampleRate: null, warning: null };
  }
  const processingEnabled = ['echoCancellation', 'noiseSuppression', 'autoGainControl']
    .some(key => settings[key] === true);
  return {
    processingEnabled,
    actualSampleRate: Number.isFinite(settings.sampleRate) ? settings.sampleRate : null,
    warning: processingEnabled
      ? 'Your device has microphone processing enabled. The recording is kept intact, and Studio can polish it non-destructively. Headphones and a quieter room can help.'
      : null,
  };
}
