import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { finalizeStudioMidiNote, retriggerStudioMidiNote } from '../lib/studioMidiRetrigger.js';

describe('Studio MIDI same-key retrigger', () => {
  it('saves the prior note when the same pitch is retriggered before Note Off', () => {
    const notes = new Map();
    const key = '5:1:60';
    const first = { trackId: 5, channel: 1, note: 60, velocity: 80 };
    const second = { ...first, velocity: 100 };
    expect(retriggerStudioMidiNote(notes, key, first, 1)).toBe(null);
    const previous = retriggerStudioMidiNote(notes, key, second, 2.5);
    expect(finalizeStudioMidiNote(previous, 2.5, () => 'first')).toEqual({
      id: 'first', note: 60, startBeat: 1, durationBeats: 1.5, velocity: 80,
    });
    expect(notes.get(key)).toEqual({ ...second, startBeat: 2.5, released: false });
  });
  it('preserves note identity across channels and other pitches', () => {
    const notes = new Map([['5:2:60', { trackId: 5, channel: 2, note: 60, startBeat: 1, velocity: 50 }]]);
    expect(retriggerStudioMidiNote(notes, '5:1:60', { trackId: 5, channel: 1, note: 60, velocity: 90 }, 3)).toBe(null);
    expect(notes.get('5:2:60').velocity).toBe(50);
  });
  it('has a minimum positive note duration for a duplicate timestamp', () => {
    const note = { note: 62, startBeat: 4, velocity: 120 };
    expect(finalizeStudioMidiNote(note, 4, () => 'id').durationBeats).toBe(.25);
  });
  it('integrates retrigger finalization into the live MIDI input handler', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const start = source.indexOf('if (command === 0x90 && velocity > 0)');
    const end = source.indexOf('} else if (command === 0x80', start);
    const block = source.slice(start, end);
    expect(block).toContain('retriggerStudioMidiNote(');
    expect(block).toContain('finalizeStudioMidiNote(retriggered, beatNow');
    expect(block).toContain('updateMidiTrack(retriggered.trackId');
  });
});
