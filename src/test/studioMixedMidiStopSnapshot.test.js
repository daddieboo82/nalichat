import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio mixed audio and MIDI takes stop at the same instant', () => {
  it('freezes MIDI notes and tempo before waiting for recorder finalization', async () => {
    const src=await readFile('src/pages/Studio.jsx','utf8');
    const from=src.indexOf('const stoppedEndTime = currentTimeRef.current');
    const to=src.indexOf('stoppedRecorder.onstop = async () => {',from);
    const block=src.slice(from,to);
    expect(block).toContain('const stoppedMidiEnabled = midiRecordingRef.current');
    expect(block).toContain('const stoppedMidiNotes = stoppedMidiEnabled ? [...midiActiveNotesRef.current.values()] : []');
    expect(block).toContain('const stoppedBpm = bpmRef.current');
    expect(block).toContain('midiRecordingRef.current = false;');
    expect(block).toContain('midiActiveNotesRef.current.clear();');
  });
  it('uses stopped values instead of live MIDI or tempo refs after audio decoding', async () => {
    const src=await readFile('src/pages/Studio.jsx','utf8');
    const from=src.indexOf('const audioUrl = URL.createObjectURL(blob);',src.indexOf('stoppedRecorder.onstop = async () => {'));
    const to=src.indexOf('// Once a take is queued for track ownership',from);
    const block=src.slice(from,to);
    expect(block).toContain('stoppedEndTime * (stoppedBpm / 60)');
    expect(block).toContain('const heldMidiNotes = stoppedMidiNotes');
    expect(block).not.toContain('midiActiveNotesRef.current.clear()');
  });
  it('saves MIDI notes when a mixed microphone take captures no audio', async () => {
    const src=await readFile('src/pages/Studio.jsx','utf8');
    const from=src.indexOf('if (blob.size === 0)');
    const to=src.indexOf('if (historyEpochRef.current === stoppedSessionEpoch)',from);
    const block=src.slice(from,to);
    expect(block).toContain('stoppedMidiNotes.filter');
    expect(block).toContain('midiNotes: [...(t.midiNotes || []), ...finalized]');
    expect(block).toContain('return { ...t, armed: false }');
  });
});
