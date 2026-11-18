// Studio-style microphone capture for shared Messaging recording sessions.
// Avoid browser call-processing on isolated tracks, retaining the dry source
// for non-destructive mastering. Constraints are best-effort by the browser.
export const sharedStudioCaptureConstraints = Object.freeze({
  audio: {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: { ideal: 1 },
    sampleRate: { ideal: 48000 },
  },
});

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
      ? 'Your browser enabled microphone processing despite the Studio request. For an unprocessed take, try a USB mic or audio interface.'
      : null,
  };
}
