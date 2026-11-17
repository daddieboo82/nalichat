// A microphone recorder failure must not discard MIDI recorded independently
// during the same take. Keep every existing audio clip and non-target track intact.
export function studioRecoverMidiOnAudioFailure(tracks, {
  armedIds, heldNotes, stoppedMidiEnabled, stopBeat, nextId,
}) {
  const armed = armedIds instanceof Set ? armedIds : new Set(armedIds || []);
  const notes = heldNotes || [];
  return tracks.map(track => {
    if (!armed.has(String(track.id))) return track;
    if (!stoppedMidiEnabled || !['midi', 'instrument'].includes(track.type)) {
      return track.armed ? { ...track, armed: false } : track;
    }
    const finalized = notes
      .filter(note => String(note.trackId) === String(track.id))
      .map(note => ({
        id: nextId(),
        note: note.note,
        startBeat: Math.round(note.startBeat * 4) / 4,
        durationBeats: Math.max(.25, Math.round((stopBeat - note.startBeat) * 4) / 4),
        velocity: note.velocity,
      }));
    return {
      ...track,
      armed: false,
      midiNotes: finalized.length
        ? [...(track.midiNotes || []), ...finalized].sort((a, b) => a.startBeat - b.startBeat)
        : (track.midiNotes || []),
    };
  });
}
