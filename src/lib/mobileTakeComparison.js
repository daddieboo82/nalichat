// Explicit takeGroupId is assigned only when recording a new performance
// onto an occupied track. Never infer similarity by track name, project,
// timestamp or waveform: unrelated recordings should not be compared.
export function relatedMobileTakes(tracks, selected) {
  if (!selected || selected.id == null || !Array.isArray(tracks)) return [];
  const key = selected.takeGroupId != null ? String(selected.takeGroupId) : null;
  const matched = key
    ? tracks.filter(t => String(t.takeGroupId ?? t.id) === key)
    : tracks.filter(t => String(t.id) === String(selected.id));
  return matched.filter(t => t && (t.audioUrl || t.file_url) &&
    ['folder','vca'].every(type => t.trackType !== type))
    .map(t => ({
      id:t.id, name:t.name || 'Vocal take', audioUrl:t.audioUrl || t.file_url,
      quality:t.captureQuality, startTime:Number(t.startTime)||0,
    }));
}

// Review uses the shared timeline player, with only the selected source audible.
export function studioPlaybackTracksForReview(tracks, trackId) {
  if (trackId == null) return tracks;
  const selected = tracks.find(track => String(track.id) === String(trackId));
  return selected ? [selected] : tracks;
}
