import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { studioMidiNoteKey, studioMidiSustainKey } from '../lib/studioMidiInputKeys.js';
import { retriggerStudioMidiNote } from '../lib/studioMidiRetrigger.js';
import { releasedStudioMidiSustainNotes } from '../lib/studioMidiSustain.js';

describe('Studio multi-controller MIDI input isolation', () => {
  it('keeps same pitch and channel separate across connected MIDI controllers', () => {
    const a = studioMidiNoteKey(5, 1, 60, 'keyboard-a');
    const b = studioMidiNoteKey(5, 1, 60, 'keyboard-b');
    expect(a).not.toBe(b);
    const notes = new Map();
    retriggerStudioMidiNote(notes, a, { trackId: 5, channel: 1, inputId: 'keyboard-a', note: 60 }, 2);
    retriggerStudioMidiNote(notes, b, { trackId: 5, channel: 1, inputId: 'keyboard-b', note: 60 }, 3);
    expect(notes.size).toBe(2);
    notes.delete(a);
    expect(notes.has(b)).toBe(true);
  });
  it('isolates sustain controls by controller, track, and channel', () => {
    expect(studioMidiSustainKey(5, 1, 'a')).not.toBe(studioMidiSustainKey(5, 1, 'b'));
    expect(studioMidiSustainKey(5, 1, 'a')).not.toBe(studioMidiSustainKey(5, 2, 'a'));
    expect(studioMidiSustainKey(5, 1, 'a')).toBe(studioMidiSustainKey('5', 1, 'a'));
  });
  it('only releases sustained notes from the controller that lifted the pedal', () => {
    const notes = new Map([
      ['a', { trackId: 5, channel: 1, inputId: 'a', note: 60, released: true }],
      ['b', { trackId: 5, channel: 1, inputId: 'b', note: 60, released: true }],
      ['c', { trackId: 5, channel: 1, inputId: 'a', note: 62, released: false }],
    ]);
    expect(releasedStudioMidiSustainNotes(notes, 5, 1, 'a').map(([k]) => k)).toEqual(['a']);
    expect(releasedStudioMidiSustainNotes(notes, 5, 1, 'b').map(([k]) => k)).toEqual(['b']);
  });
  it('uses input-scoped keys in the live MIDI event handler', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const from = source.indexOf('input.onmidimessage = (event) => {');
    const end = source.indexOf('              };', from);
    const handler = source.slice(from, end);
    expect(handler).toContain("const inputId = input.id ?? '';");
    expect(handler).toContain('studioMidiNoteKey(track.id, channel, note, inputId)');
    expect(handler).toContain('studioMidiSustainKey(track.id, channel, inputId)');
    expect(handler).toContain('releasedStudioMidiSustainNotes(midiActiveNotesRef.current, track.id, channel, inputId)');
  });
});
