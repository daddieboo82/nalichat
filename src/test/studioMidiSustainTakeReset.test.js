import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio MIDI sustain pedal is isolated between takes', () => {
  it('resets sustain when a MIDI-only take begins', async () => {
    const source = await readFile('src/pages/Studio.jsx','utf8');
    const start=source.indexOf('if (armedMidiOnly) {',source.indexOf('const toggleRecord = async () => {'));
    const end=source.indexOf('const startupToken',start);
    const block=source.slice(start,end);
    expect(block).toContain('midiActiveNotesRef.current.clear();\n        midiSustainRef.current.clear();\n        midiRecordingRef.current = true;');
  });
  it('resets sustain after capturing held notes at MIDI-only Stop', async () => {
    const source=await readFile('src/pages/Studio.jsx','utf8');
    const start=source.indexOf('if (midiRecordingRef.current && (!mediaRecorderRef.current');
    const end=source.indexOf('setTracksWithHistory(prev => {',start);
    const block=source.slice(start,end);
    expect(block).toContain('const heldNotes = [...midiActiveNotesRef.current.values()];\n      midiActiveNotesRef.current.clear();\n      midiSustainRef.current.clear();');
  });
  it('resets sustain on mixed take start and after Stop snapshots MIDI', async () => {
    const source=await readFile('src/pages/Studio.jsx','utf8');
    const stopStart=source.indexOf('const stoppedMidiNotes =');
    const stopEnd=source.indexOf('stoppedRecorder.onstop = async () => {',stopStart);
    expect(source.slice(stopStart,stopEnd)).toContain('midiActiveNotesRef.current.clear();\n      midiSustainRef.current.clear();');
    const start=source.indexOf('const hasArmedMidi =',source.indexOf('const startupToken ='));
    const end=source.indexOf('microphoneStartupRef.current.pending = false;',start);
    expect(source.slice(start,end)).toContain('midiActiveNotesRef.current.clear();\n          midiSustainRef.current.clear();\n          midiRecordingRef.current = true;');
  });
  it('drops remaining sustain state when Studio unmounts', async () => {
    const source=await readFile('src/pages/Studio.jsx','utf8');
    const start=source.indexOf('studioMountedRef.current = false;');
    const end=source.indexOf('if (mediaStreamRef.current)',start);
    expect(source.slice(start,end)).toContain('midiSustainRef.current.clear()');
  });
});
