// Non-destructive Studio Auto Polish selector.
// The global toggle affects tagged vocal tracks, matching vocal track names,
// and freshly captured microphone takes; instruments and beats are excluded.
const VOCAL_NAME = /(?:^|[\s_(\-/])(vocal(?:s)?|vox|voice|singer|singing|rap|rapping|lead\s+vox|harmony|harmonies|backing\s+vox|mic)(?=$|[\s_)\-/.])/i;
const VOCAL_TYPES = new Set(['vocal', 'vocals', 'voice', 'singing', 'rap']);

export function isAutoPolishVocalTrack(track) {
  if (!track || track.trackType === 'folder' || track.trackType === 'vca') return false;
  const kind = String(track.type || '').toLowerCase();
  if (['midi', 'instrument', 'beat', 'drums', 'instrumental', 'bus', 'master'].includes(kind)) return false;
  if (track.isInstrumental === true || track.instrument) return false;
  return VOCAL_TYPES.has(kind) || track.recordedFromMicrophone === true ||
    track.isVocal === true || VOCAL_NAME.test(String(track.name || ''));
}

export function setVocalAutoPolish(tracks, enabled) {
  if (!Array.isArray(tracks)) return tracks;
  let changed = false;
  const next = tracks.map(track => {
    const want = enabled && isAutoPolishVocalTrack(track);
    if (!!track.autoPolish === want) return track;
    changed = true;
    return { ...track, autoPolish: want };
  });
  return changed ? next : tracks;
}
