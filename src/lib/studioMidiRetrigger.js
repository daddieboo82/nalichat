// Preserve the earlier note when a controller retriggers an already active
// pitch before sending Note Off. The replacement starts at the new beat.
export function retriggerStudioMidiNote(activeNotes, key, note, beatNow) {
  const previous = activeNotes.get(key) || null;
  activeNotes.set(key, { ...note, startBeat: beatNow, released: false });
  return previous;
}

export function finalizeStudioMidiNote(active, endBeat, nextId) {
  return {
    id: nextId(),
    note: active.note,
    startBeat: Math.round(active.startBeat * 4) / 4,
    durationBeats: Math.max(.25, Math.round((endBeat - active.startBeat) * 4) / 4),
    velocity: active.velocity,
  };
}
