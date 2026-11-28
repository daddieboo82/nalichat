// Rendering-only peak aggregation. No mutation of source audio or saved peaks.
// Keep at least one source bin per CSS pixel; at high zoom retain every bin.
export function studioWaveformStep(count, displayWidth) {
  if (!Number.isFinite(displayWidth) || displayWidth <= 0) return 1;
  return Math.max(1, Math.floor(count / Math.max(1, Math.ceil(displayWidth))));
}

export function studioWaveformBins(waveform, first, last, step = 1) {
  const bins = [];
  for (let i = first; i < last; i += step) {
    const end = Math.min(last, i + step);
    let peak = 0;
    for (let j = i; j < end; j++) {
      const value = waveform[j];
      if (Number.isFinite(value)) peak = Math.max(peak, Math.min(1, Math.abs(value)));
    }
    bins.push({ first: i, last: end, peak });
  }
  return bins;
}
