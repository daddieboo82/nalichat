import { openStudioMicrophone, inspectSharedStudioCaptureSettings, studioMicrophoneErrorMessage } from './sharedStudioCapture';
import { createPreferredStudioRecorder } from './studioPcmRecorder';
import { studioRecoveryStorageHealth } from './studioRecoveryStorageHealth';

// Explicit, user-initiated microphone check. Never starts a recording, saves
// audio, trains a model or uploads device information. Always releases the
// microphone and browser audio graph, including when a check fails.
export async function runMobileStudioPreflight({
  mediaDevices = globalThis.navigator?.mediaDevices,
  storage = globalThis.navigator?.storage,
  MediaRecorderType = globalThis.MediaRecorder,
  AudioContextType = globalThis.AudioContext || globalThis.webkitAudioContext,
  WorkletNodeType = globalThis.AudioWorkletNode,
  openMicrophone = openStudioMicrophone,
  selectRecorder = createPreferredStudioRecorder,
  signal,
} = {}) {
  if (signal?.aborted) throw signal.reason || new Error('Microphone check cancelled.');
  const storageHealth = await studioRecoveryStorageHealth({storage});
  let stream;
  let recorder;
  const result = {
    microphone: 'unknown',
    recordingEngine: 'unknown',
    processingEnabled: false,
    sampleRate: null,
    storageLevel: storageHealth.level,
    storageDetail: storageHealth.detail || storageHealth.reason,
    issues: [],
  };
  try {
    stream = await openMicrophone(mediaDevices);
    if (signal?.aborted) throw signal.reason || new Error('Microphone check cancelled.');
    if (!stream?.getAudioTracks?.().some(track => track.readyState === 'live')) {
      throw new Error('No active microphone track was provided.');
    }
    result.microphone = 'ready';
    const settings = inspectSharedStudioCaptureSettings(stream.getAudioTracks()[0]?.getSettings?.());
    result.sampleRate = settings.actualSampleRate;
    result.processingEnabled = settings.processingEnabled;
    if (settings.warning) result.issues.push(settings.warning);
    if (!AudioContextType || !WorkletNodeType) {
      result.issues.push('Lossless capture may be unavailable on this browser. A compatible recording fallback will be used if supported.');
    }
    try {
      const preferred = await selectRecorder(stream, {
        MediaRecorderType,
        createLossless: undefined,
      });
      recorder = preferred?.recorder;
      result.recordingEngine = preferred?.lossless ? 'lossless-wav' : 'browser-codec';
    } catch {
      result.recordingEngine = 'unavailable';
      result.issues.push('This browser could not initialize a recording engine.');
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    result.microphone = 'unavailable';
    result.issues.push(studioMicrophoneErrorMessage(error));
  } finally {
    try {recorder?.dispose?.();} catch {}
    try {stream?.getTracks?.().forEach(track => track.stop());} catch {}
  }
  if (storageHealth.level === 'critical' || storageHealth.level === 'warning') {
    result.issues.push(storageHealth.detail);
  }
  return result;
}
