// Match the row heights used by the desktop timeline. Keep all shells mounted.
export function studioLaneHeight(track) {
  return track.trackType === 'vca' ? 96 : track.trackType === 'folder' ? 48 :
    (track.height ? Number(track.height) : track.showAutomation ? 176 : 112);
}
export function studioVisibleWaveformLanes(lanes, viewport) {
  if (!viewport || !Number.isFinite(viewport.top) || !Number.isFinite(viewport.height) || viewport.height <= 0) return null;
  const visible = new Set();
  let y = 32; // timeline ruler
  for (const lane of lanes) {
    const height = studioLaneHeight(lane.primary);
    if (!Number.isFinite(height) || height <= 0) return null;
    if (y + height >= viewport.top - 336 && y <= viewport.top + viewport.height + 336) visible.add(lane.primary.id);
    y += height;
  }
  return visible;
}
