// AI Reconstruction accepts any user-selected audio clip. Track naming
// should never prevent the user from deciding whether it contains vocals.
export function selectReconstructionTrack(tracks, selectedIds) {
  const ids = new Set((selectedIds || []).map(String));
  return (tracks || []).find(track =>
    ids.has(String(track?.id)) &&
    typeof track?.audioUrl === 'string' &&
    track.audioUrl.trim().length > 0 &&
    !['midi', 'instrument'].includes(String(track.type || '').toLowerCase()) &&
    !track.instrument &&
    !['folder', 'vca'].includes(String(track.trackType || '').toLowerCase())
  ) || null;
}
