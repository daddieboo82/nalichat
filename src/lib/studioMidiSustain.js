// Sustain release is scoped to a particular MIDI channel within a track.
// A controller on one channel must never terminate notes on another.
export function releasedStudioMidiSustainNotes(activeNotes, trackId, channel, inputId) {
  return [...activeNotes.entries()].filter(([, active]) =>
    String(active.trackId) === String(trackId) &&
    active.channel === channel &&
    (inputId === undefined || String(active.inputId ?? '') === String(inputId)) &&
    active.released === true
  );
}
