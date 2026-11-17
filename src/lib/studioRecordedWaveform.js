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
