import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { drainStudioDisconnectedMidiNotes } from '../lib/studioMidiDisconnect.js';
import { studioMidiNoteKey, studioMidiSustainKey } from '../lib/studioMidiInputKeys.js';

describe('Studio MIDI controller disconnect cleanup', () => {
  it('drains only disconnected controller notes without affecting other controllers', () => {
    const a = studioMidiNoteKey(2, 1, 60, 'a');
    const b = studioMidiNoteKey(2, 1, 60, 'b');
    const notes = new Map([
      [a, { inputId: 'a', trackId: 2, channel: 1, note: 60, startBeat: 1, velocity: 88 }],
      [b, { inputId: 'b', trackId: 2, channel: 1, note: 60, startBeat: 2, velocity: 99 }],
    ]);
    const sustain = new Map([
      [studioMidiSustainKey(2, 1, 'a'), true],
      [studioMidiSustainKey(2, 1, 'b'), true],
    ]);
    const drained = drainStudioDisconnectedMidiNotes(notes, sustain, 'a');
    expect(drained).toHaveLength(1);
    expect(drained[0].velocity).toBe(88);
    expect(notes.has(a)).toBe(false);
    expect(notes.has(b)).toBe(true);
    expect(sustain.has(studioMidiSustainKey(2, 1, 'a'))).toBe(false);
    expect(sustain.has(studioMidiSustainKey(2, 1, 'b'))).toBe(true);
  });
  it('is idempotent for repeated disconnect events', () => {
    const notes = new Map([[studioMidiNoteKey(1, 1, 60, 'a'), { inputId: 'a', trackId: 1 }]]);
    const sustain = new Map();
    expect(drainStudioDisconnectedMidiNotes(notes, sustain, 'a')).toHaveLength(1);
    expect(drainStudioDisconnectedMidiNotes(notes, sustain, 'a')).toHaveLength(0);
  });
  it('handles unknown non-JSON sustain keys without touching another controller', () => {
    const sustain = new Map([['legacy:1:64', true], [studioMidiSustainKey(1, 2, 'b'), true]]);
    expect(() => drainStudioDisconnectedMidiNotes(new Map(), sustain, 'a')).not.toThrow();
    expect(sustain.size).toBe(2);
  });
  it('finalizes disconnected notes only into the original project session', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const from = source.indexOf("if (e.port?.type === 'input' && e.port.state === 'disconnected')");
    const to = source.indexOf('                bindMidiInputs();', from);
    const block = source.slice(from, to);
    expect(block).toContain('drainStudioDisconnectedMidiNotes(');
    expect(block).toContain('finalizeStudioMidiNote(note, stopBeat');
    expect(block).toContain('if (!mounted || historyEpochRef.current !== inputEpoch) return prev;');
    expect(block).toContain('midiInputsBound.delete(e.port)');
  });
});
