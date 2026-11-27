// Convert durable project state back into editor clips without manufacturing
// audio on empty lanes. Keep the split lineage and clip offsets unchanged.
export function hydrateStudioTracks(savedTracks, waveformFallback = () => []) {
  if (!Array.isArray(savedTracks)) return [];
  return savedTracks.map(track => {
    const audioUrl = track.audioUrl || track.file_url || '';
    const waveform = Array.isArray(track.waveform) && track.waveform.length > 0
      ? track.waveform
      : audioUrl ? waveformFallback(track) : [];
    return { ...track, audioUrl, waveform };
  });
}


export const STUDIO_WAVEFORM_VERSION = 2;

// Old persisted peaks may have been normalized or synthesized. Refresh only
// source-backed clips; never discard the existing display on decode failure.
export function needsStudioWaveformRefresh(track) {
  return !!track?.audioUrl && (!track.waveform?.length ||
    track.waveformVersion !== STUDIO_WAVEFORM_VERSION);
}

export function applyStudioWaveformRefresh(track, recovered) {
  if (!needsStudioWaveformRefresh(track) || !recovered?.waveform?.length) return track;
  return {
    ...track,
    waveform: recovered.waveform,
    waveformVersion: STUDIO_WAVEFORM_VERSION,
    // Keep existing source-time metadata and all edit boundaries.
    ...(!(track.fullDuration > 0) && recovered.fullDuration > 0
      ? { fullDuration: recovered.fullDuration } : {}),
  };
}
