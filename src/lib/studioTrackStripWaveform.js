// Use measured waveform peaks, not random decorative bars. Zero samples
// remain silent and empty tracks show no measured signal.
export function studioTrackStripWaveformBars(waveform, count = 60) {
  const bars = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0));
  if (!bars) return [];
  if (!waveform || typeof waveform.length !== 'number' || waveform.length === 0) return Array(bars).fill(0);
  const length = waveform.length;
  return Array.from({ length: bars }, (_, index) => {
    const start = Math.floor(index * length / bars);
    const end = Math.min(length, Math.max(start + 1, Math.ceil((index + 1) * length / bars)));
    let peak = 0;
    for (let i = start; i < end; i++) {
      const sample = Number(waveform[i]);
      if (Number.isFinite(sample)) peak = Math.max(peak, Math.abs(sample));
    }
    return Math.min(1, peak);
  });
}
