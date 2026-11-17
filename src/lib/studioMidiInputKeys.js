// Separate notes and sustain controls from different physical MIDI inputs,
// even when they send the same pitch/channel into the same armed track.
export function studioMidiNoteKey(trackId, channel, note, inputId) {
  return JSON.stringify([String(trackId), Number(channel), Number(note), String(inputId ?? '')]);
}

export function studioMidiSustainKey(trackId, channel, inputId) {
  return JSON.stringify([String(trackId), Number(channel), String(inputId ?? '')]);
}
