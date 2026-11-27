// Live waveform samples are display-only. The recorder owns original PCM bytes.
// Bound preview history to prevent a long take from growing one UI array forever.
// Pairwise peak merging retains transients when detail is reduced.
export const STUDIO_LIVE_WAVEFORM_LIMIT = 4096;

export function appendStudioLiveWaveform(points, amplitude, limit = STUDIO_LIVE_WAVEFORM_LIMIT) {
  if (!Array.isArray(points)) return [];
  const safeLimit = Number.isSafeInteger(limit) && limit >= 2 ? limit : STUDIO_LIVE_WAVEFORM_LIMIT;
  points.push(Number.isFinite(amplitude) ? Math.max(0, Math.min(1, amplitude)) : 0);
  if (points.length <= safeLimit) return points;
  const merged = [];
  for (let i = 0; i < points.length; i += 2) {
    merged.push(Math.max(points[i], points[i + 1] ?? 0));
  }
  return merged;
}

// Render only when the canvas gains an additional display pixel (or resets).
// A 60fps animation loop does not need to redraw a 20px/second time axis 60fps.
export function shouldRedrawStudioWaveform(canvas, targetWidth, sampleCount) {
  if (!canvas || !Number.isFinite(targetWidth) || targetWidth < 1 || sampleCount < 2) return false;
  return canvas.width !== targetWidth || canvas.dataset?.studioWaveformSamples == null;
}
