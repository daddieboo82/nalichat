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
