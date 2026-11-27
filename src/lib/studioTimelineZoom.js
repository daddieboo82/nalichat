// Keep the timeline below a conservative browser layout width. The scale
// remains uniform: never truncate the timeline while leaving clip offsets unchanged.
export function studioTimelineZoomLimit(seconds) {
  return Math.max(0.5, Math.min(5000, 8000000 / (20 * Math.max(100, Number.isFinite(seconds) ? seconds : 100))));
}
