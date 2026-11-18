// NaliChat Studio capture-quality telemetry measured from *actual* decoded
// microphone samples. Does not alter source audio, persist recordings, or
// confuse an audio-chat stream with a production-quality multitrack take.
export function analyzeStudioCaptureQuality(buffer, { noiseFloorDb = -55 } = {}) {
  const channels = Number(buffer?.numberOfChannels) || 0;
  const frames = Number(buffer?.length) || 0;
  const rate = Number(buffer?.sampleRate) || 0;
  if (!channels || channels > 32 || !frames || !Number.isFinite(rate) || rate < 8000) {
    return { status: 'unavailable', reason: 'Could not measure this recording.' };
  }
  let peak = 0;
  let energy = 0;
  let samples = 0;
  let clipped = 0;
  for (let channel = 0; channel < channels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < frames; i++) {
      const value = data[i];
      if (!Number.isFinite(value)) continue;
      const magnitude = Math.abs(value);
      peak = Math.max(peak, magnitude);
      energy += value * value;
      clipped += magnitude >= 0.995 ? 1 : 0;
      samples++;
    }
  }
  if (!samples) return { status: 'unavailable', reason: 'Could not measure this recording.' };
  const rms = Math.sqrt(energy / samples);
  const peakDb = peak > 0 ? 20 * Math.log10(peak) : -Infinity;
  const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
  const clippingRatio = clipped / samples;
  let status = 'good';
  let note = 'Recording level looks healthy. Keep using headphones to avoid bleed.';
  if (peak <= 0.0001 || rmsDb < noiseFloorDb) {
    status = 'silent';
    note = 'Your microphone was extremely quiet. Check mic permission, distance and input gain.';
  } else if (clippingRatio >= 0.001 || peakDb > -0.1) {
    status = 'clipping';
    note = 'Your microphone may be clipping. Lower input gain or move back before recording again.';
  } else if (rmsDb < -35 && peakDb < -18) {
    status = 'quiet';
    note = 'This take is very quiet. Move closer or raise microphone gain; do not boost background noise afterward.';
  }
  return { status, note, peakDb, rmsDb, clippingRatio, sampleRate: rate, channels };
}
