import { getStudioClipLaneId } from './studioClipLanes.js';

// Keep existing clip material non-destructively when a new microphone take is
// captured. A blank lane can receive the first take in place; an occupied lane
// receives a separate take track rather than replacing its source and trims.
export function applyStudioRecordedTake(tracks, { audioUrl, waveform, startTime, duration, nextId, captureQuality, latencyCorrectionSeconds = 0 }) {
  const result = tracks.map(t => ({ ...t, armed: false }));
  let id = nextId;
  for (const track of tracks) {
    if (!track.armed || ['midi', 'instrument'].includes(track.type)) continue;
    const occupied = tracks.some(t => getStudioClipLaneId(t) === getStudioClipLaneId(track) &&
      Boolean(t.audioUrl || t.file_url));
    const correction = Number.isFinite(latencyCorrectionSeconds) && latencyCorrectionSeconds > 0 &&
      latencyCorrectionSeconds < duration * 0.1 ? latencyCorrectionSeconds : 0;
    const capture = {
      audioUrl, file_url: audioUrl, waveform, startTime, duration: duration - correction,
      captureQuality: captureQuality || null,
      fullDuration: duration, clipStart: correction,
      latencyCompensationMs: Math.round(correction * 1000),
      fadeIn: 0, fadeOut: 0, clipGain: 0,
      armed: false, recordedFromMicrophone: true,
    };
    if (occupied) {
      // Preserve an explicit, non-destructive take family so the phone can
      // switch between performances without confusing unrelated vocal lanes.
      const takeGroupId = String(track.takeGroupId || track.id);
      const originalIndex = result.findIndex(item => String(item.id) === String(track.id));
      if (originalIndex >= 0) result[originalIndex] = {...result[originalIndex],takeGroupId};
      // A new lane avoids accidentally mixing a new take into an existing
      // split track while retaining the original for editing or Undo.
      const { splitFrom: _splitFrom, _persistedTrackId: _persisted, persisted_track_id: _pid,
        playlists: _playlists, effects: _effects, plugins: _plugins, ...base } = track;
      result.push({ ...base, ...capture, takeGroupId, id: id++, name: `${track.name || 'Audio'} (New Take)`,
        muted: false, solo: false, clipGain: 0, fadeIn: 0, fadeOut: 0 });
    } else {
      const position = result.findIndex(t => String(t.id) === String(track.id));
      result[position] = { ...result[position], ...capture };
    }
  }
  return result;
}

export function studioNewRecordingLaneCount(tracks) {
  return (tracks || []).filter(track => track.armed &&
    !['midi', 'instrument'].includes(track.type) &&
    tracks.some(other => getStudioClipLaneId(other) === getStudioClipLaneId(track) &&
      Boolean(other.audioUrl || other.file_url))).length;
}
