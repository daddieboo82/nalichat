// Drain only notes that belong to the unplugged input. Removing them from the
// active map prevents a later Stop from saving the same held notes twice.
export function drainStudioDisconnectedMidiNotes(activeNotes, sustain, inputId) {
  const id = String(inputId ?? '');
  const drained = [];
  for (const [key, note] of activeNotes) {
    if (String(note.inputId ?? '') !== id) continue;
    drained.push(note);
    activeNotes.delete(key);
  }
  for (const key of sustain.keys()) {
    try {
      const parsed = JSON.parse(key);
      if (Array.isArray(parsed) && parsed.length === 3 && parsed[2] === id) sustain.delete(key);
    } catch {
      // Unknown legacy sustain entries cannot be attributed to an input.
    }
  }
  return drained;
}
