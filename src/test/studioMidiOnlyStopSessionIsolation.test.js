import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio MIDI-only stop session isolation', () => {
  it('snapshots MIDI lane targets and project epoch at Stop', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const start = source.indexOf('if (midiRecordingRef.current && (!mediaRecorderRef.current');
    const end = source.indexOf('if (mediaRecorderRef.current && mediaRecorderRef.current.state',start);
    const midi = source.slice(start,end);
    expect(midi).toContain('const stoppedMidiEpoch = historyEpochRef.current');
    expect(midi).toContain('const stoppedMidiArmedIds = new Set(');
    expect(midi).toContain('.map(t => String(t.id))');
    expect(midi).toContain('const heldNotes = [...midiActiveNotesRef.current.values()]');
  });
  it('rejects deferred MIDI-only stop updates after a project switch', async () => {
    const source = await readFile('src/pages/Studio.jsx','utf8');
    const start = source.indexOf('if (midiRecordingRef.current && (!mediaRecorderRef.current');
    const end = source.indexOf('if (mediaRecorderRef.current && mediaRecorderRef.current.state',start);
    const midi = source.slice(start,end);
    expect(midi).toContain('setTracksWithHistory(prev => {');
    expect(midi).toContain('if (historyEpochRef.current !== stoppedMidiEpoch) return prev');
    expect(midi).toContain('stoppedMidiArmedIds.has(String(t.id))');
    expect(midi).toContain('String(note.trackId) === String(t.id)');
  });
  it('uses ID-normalized held-note matching for mixed audio and MIDI takes too', async () => {
    const source = await readFile('src/pages/Studio.jsx','utf8');
    const start = source.indexOf('const midiFinalized = prev.map(t => {');
    const end = source.indexOf('return applyStudioRecordedTake',start);
    expect(source.slice(start,end)).toContain('String(note.trackId) === String(t.id)');
  });
});
