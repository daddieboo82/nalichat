// Display-only recording waveform; captured PCM is never modified.
// Time-stamped peaks preserve placement even when old preview points are merged.
export const STUDIO_LIVE_WAVEFORM_LIMIT = 4096;
export const STUDIO_LIVE_CANVAS_MAX_WIDTH = 4096;
export const STUDIO_LIVE_REDRAW_INTERVAL_MS = 100;

export function appendStudioLiveWaveform(points, amplitude, timeSeconds = 0, limit = STUDIO_LIVE_WAVEFORM_LIMIT) {
  if (!Array.isArray(points)) return [];
  const safeLimit = Number.isSafeInteger(limit) && limit >= 2 ? limit : STUDIO_LIVE_WAVEFORM_LIMIT;
  const time = Number.isFinite(timeSeconds) ? Math.max(0, timeSeconds) : 0;
  const peak = Number.isFinite(amplitude) ? Math.max(0, Math.min(1, amplitude)) : 0;
  points.push({ time, peak });
  if (points.length <= safeLimit) return points;
  const merged = [];
  for (let i = 0; i < points.length; i += 2) {
    const second = points[i + 1];
    merged.push({ time: second?.time ?? points[i].time,
      peak: Math.max(points[i].peak, second?.peak ?? 0) });
  }
  return merged;
}

export function studioLiveCanvasWidth(width) {
  return Number.isFinite(width) && width > 0
    ? Math.min(STUDIO_LIVE_CANVAS_MAX_WIDTH, Math.max(1, Math.ceil(width))) : 0;
}

// Once canvas width is capped, redraw at a modest cadence so long takes remain
// visibly alive without rendering every requestAnimationFrame.
export function shouldRedrawStudioWaveform(canvas, targetWidth, sampleCount, nowMs = 0) {
  if (!canvas || !Number.isFinite(targetWidth) || targetWidth < 1 || sampleCount < 2) return false;
  if (canvas.width !== targetWidth || canvas.dataset?.studioWaveformSamples == null) return true;
  const last = Number(canvas.dataset?.studioWaveformLastDrawMs);
  return Number.isFinite(nowMs) && Number.isFinite(last) && nowMs >= last + STUDIO_LIVE_REDRAW_INTERVAL_MS;
}

// Canvas allocation can fail on resource-constrained phones. Treat visual
// errors as non-fatal: the microphone and recording stream must keep running.
export function drawStudioLiveWaveform(canvas, points, elapsedSeconds, widthPixels, nowMs) {
  if (!canvas || !Array.isArray(points)) return false;
  const targetWidth = studioLiveCanvasWidth(widthPixels);
  if (!shouldRedrawStudioWaveform(canvas, targetWidth, points.length, nowMs)) return false;
  try {
    const context = canvas.getContext?.('2d');
    if (!context) return false;
    if (canvas.width !== targetWidth) canvas.width = targetWidth;
    const height = canvas.height;
    context.clearRect(0, 0, targetWidth, height);
    const centerY = height / 2;
    const maxAmplitude = height * 0.42;
    context.strokeStyle = 'rgba(239, 68, 68, 0.9)';
    context.lineWidth = 1;
    context.beginPath();
    for (const point of points) {
      const x = studioLiveWaveformX(point.time, elapsedSeconds, targetWidth);
      const amplitude = Math.min(1, Math.max(0.002, point.peak)) * maxAmplitude;
      context.moveTo(x, centerY - amplitude);
      context.lineTo(x, centerY + amplitude);
    }
    context.stroke();
    context.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0, centerY);
    context.lineTo(targetWidth, centerY);
    context.stroke();
    if (canvas.dataset) {
      canvas.dataset.studioWaveformSamples = String(points.length);
      canvas.dataset.studioWaveformLastDrawMs = String(nowMs);
    }
    return true;
  } catch {
    // An exhausted or unsupported 2D canvas cannot be allowed to break audio.
    return false;
  }
}

export function studioLiveWaveformX(time, elapsed, canvasWidth) {
  if (!Number.isFinite(time) || !Number.isFinite(elapsed) || elapsed <= 0 || !Number.isFinite(canvasWidth)) return 0;
  return Math.max(0, Math.min(canvasWidth, (time / elapsed) * canvasWidth));
}
