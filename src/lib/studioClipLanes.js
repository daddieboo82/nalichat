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
