// Build a waveform from actual decoded samples, never synthetic peaks.
// A zero-length or silent recording has no measured transients.
export function studioRecordedWaveform(audioBuffer, pointCount) {
  const points = Math.max(0, Math.floor(Number.isFinite(pointCount) ? pointCount : 0));
  if (!audioBuffer || !points || !Number.isFinite(audioBuffer.length) || audioBuffer.length <= 0) return [];
  const channels = Math.max(0, Math.floor(audioBuffer.numberOfChannels || 0));
  if (!channels) return Array(points).fill(0);
  const samples = Array.from({ length: channels }, (_, channel) => audioBuffer.getChannelData(channel));
  const peaks = new Array(points).fill(0);
  for (let i = 0; i < points; i++) {
    const start = Math.floor(i * audioBuffer.length / points);
    const end = Math.min(audioBuffer.length, Math.max(start + 1, Math.floor((i + 1) * audioBuffer.length / points)));
    let peak = 0;
    for (const channel of samples) {
      for (let j = start; j < end; j++) {
        const value = Math.abs(channel[j] || 0);
        if (Number.isFinite(value) && value > peak) peak = value;
      }
    }
    peaks[i] = Math.min(1, peak);
  }
  return peaks;
}


// Region detail is a bounded peak envelope, not a resampled audio signal.
// Return exact frame boundaries so the caller can position it in source time.
export function studioWaveformRegion(audioBuffer, startTime, endTime, requestedPoints = 2048) {
  const rate = audioBuffer?.sampleRate;
  const length = audioBuffer?.length;
  if (!Number.isFinite(rate) || rate <= 0 || !Number.isSafeInteger(length) || length <= 0 ||
      !Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime ||
      !Number.isFinite(requestedPoints) || requestedPoints < 1) return null;
  const first = Math.max(0, Math.min(length, Math.floor(startTime * rate)));
  const last = Math.max(first, Math.min(length, Math.ceil(endTime * rate)));
  if (last <= first) return null;
  const channels = audioBuffer.numberOfChannels;
  // Cap both output allocation and synchronous scanning work.
  if (!Number.isSafeInteger(channels) || channels < 1 || channels * (last - first) > 2000000) return null;
  const points = Math.min(8192, Math.floor(requestedPoints), last - first);
  const region = {
    length: last - first,
    numberOfChannels: channels,
    getChannelData: channel => audioBuffer.getChannelData(channel).subarray(first, last),
  };
  return {
    waveform: studioRecordedWaveform(region, points),
    startTime: first / rate,
    duration: (last - first) / rate,
    firstFrame: first,
    endFrame: last,
  };
}
