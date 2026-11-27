// Keep clip shells and editing handles mounted; cull only expensive waveform geometry.
export function studioClipWaveformVisible(clip, zoom, viewport, selected = false) {
  if (selected || !viewport || !Number.isFinite(viewport.left) ||
      !Number.isFinite(viewport.width) || viewport.width <= 0 ||
      !Number.isFinite(zoom) || zoom <= 0) return true;
  const start = (clip.startTime ?? 0) * 20 * zoom;
  const end = start + (clip.duration ?? 40) * 20 * zoom;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return true;
  return end >= viewport.left - 512 && start <= viewport.left + viewport.width + 512;
}
