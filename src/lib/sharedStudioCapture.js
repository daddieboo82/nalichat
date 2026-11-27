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
  if (!mediaDevices?.getUserMedia) throw new DOMException('This browser cannot access a microphone.', 'NotSupportedError');
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

export function studioMicrophoneErrorMessage(error) {
  switch (error?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'Microphone access is blocked. Allow NaliChat to use your microphone in your browser or device settings, then try again.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No microphone was detected. Connect a microphone or enable your built-in microphone, then try again.';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'Your browser found a microphone but could not start it. Close other apps using it or reconnect it, then try again.';
    case 'NotSupportedError':
      return 'This browser cannot access a microphone. Try opening Studio in a browser that supports recording.';
    default:
      return error?.message || 'This browser could not open the microphone.';
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
