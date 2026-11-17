import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { releasedStudioMidiSustainNotes } from '../lib/studioMidiSustain.js';

describe('Studio sustain release respects MIDI channel boundaries', () => {
  const notes = new Map([
    ['8:1:60', { trackId: 8, channel: 1, note: 60, released: true }],
    ['8:2:62', { trackId: 8, channel: 2, note: 62, released: true }],
    ['9:1:64', { trackId: 9, channel: 1, note: 64, released: true }],
    ['8:1:65', { trackId: 8, channel: 1, note: 65, released: false }],
  ]);
  it('releases only sustained notes on the selected track and channel', () => {
    expect(releasedStudioMidiSustainNotes(notes, 8, 1).map(([key]) => key))
      .toEqual(['8:1:60']);
    expect(releasedStudioMidiSustainNotes(notes, '8', 2).map(([key]) => key))
      .toEqual(['8:2:62']);
  });
  it('does not release notes still held by keys, even on the same channel', () => {
    expect(releasedStudioMidiSustainNotes(new Map([['a', notes.get('8:1:65')]]), 8, 1)).toEqual([]);
  });
  it('records the MIDI input channel on each active note before sustain handling', async () => {
    const s = await readFile('src/pages/Studio.jsx','utf8');
    expect(s).toContain('midiActiveNotesRef.current.set(key, { trackId: track.id, channel, note, startBeat: beatNow, velocity, released: false });');
    expect(s).toContain('releasedStudioMidiSustainNotes(midiActiveNotesRef.current, track.id, channel)');
  });
});
