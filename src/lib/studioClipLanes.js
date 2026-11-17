// Derive visible timeline lanes without changing persisted clips.
// Studio currently stores each split clip as a separate flat track record.
// A shared splitFrom lineage groups the clips visually while individual IDs
// remain available to playback, edits, autosave, and exports.
export function getStudioClipLaneId(clip) {
  return String(clip?.splitFrom ?? clip?.id ?? '');
}

export function groupStudioClipLanes(tracks) {
  const lanes = [];
  const byKey = new Map();
  for (const track of Array.isArray(tracks) ? tracks : []) {
    if (!track || (track.id === undefined || track.id === null)) continue;
    const key = getStudioClipLaneId(track);
    let lane = byKey.get(key);
    if (!lane) {
      lane = { key, primary: track, clips: [] };
      byKey.set(key, lane);
      lanes.push(lane);
    }
    lane.clips.push(track);
    // Prefer the original root track when it still exists, even if a
    // split sibling precedes it in loaded data.
    if (String(track.id) === key) lane.primary = track;
  }
  for (const lane of lanes) {
    lane.clips.sort((a, b) =>
      (Number(a.startTime) || 0) - (Number(b.startTime) || 0) ||
      String(a.id).localeCompare(String(b.id))
    );
  }
  return lanes;
}

// The header drag list and timeline must agree on precisely which lanes are
// visible. Hidden lanes and collapsed folder children retain their positions
// in saved project data even when their rows aren't displayed.
export function visibleStudioClipLanes(tracks) {
  const all = groupStudioClipLanes(tracks);
  const collapsed = new Set();
  for (const track of tracks || []) {
    if (track?.trackType === 'folder' && track.collapsed) {
      for (const id of track.folderMembers || []) collapsed.add(String(id));
    }
  }
  return all.filter(lane =>
    !lane.primary.hidden && !lane.clips.some(clip => collapsed.has(String(clip.id))));
}

export function reorderVisibleStudioClipLanes(tracks, fromIndex, toIndex) {
  const all = groupStudioClipLanes(tracks);
  const visible = visibleStudioClipLanes(tracks);
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) ||
      fromIndex < 0 || toIndex < 0 ||
      fromIndex >= visible.length || toIndex >= visible.length ||
      fromIndex === toIndex) return tracks;
  const moved = visible.splice(fromIndex, 1)[0];
  visible.splice(toIndex, 0, moved);
  const visibleKeys = new Set(visible.map(lane => lane.key));
  let next = 0;
  return all.map(lane => visibleKeys.has(lane.key) ? visible[next++] : lane)
    .flatMap(lane => lane.clips);
}
