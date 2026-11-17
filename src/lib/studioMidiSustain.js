// Sustain release is scoped to a particular MIDI channel within a track.
// A controller on one channel must never terminate notes on another.
export function releasedStudioMidiSustainNotes(activeNotes, trackId, channel) {
  return [...activeNotes.entries()].filter(([, active]) =>
    String(active.trackId) === String(trackId) &&
    active.channel === channel &&
    active.released === true
  );
}
