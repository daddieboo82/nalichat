import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { studioRecoverMidiOnAudioFailure } from '../lib/studioRecoverMidiOnAudioFailure.js';

const makeOptions = (overrides={}) => ({
  armedIds: new Set(['1', '2']),
  heldNotes: [{ trackId: '2', note: 60, startBeat: 3, velocity: 95 }],
  stoppedMidiEnabled: true,
  stopBeat: 5,
  nextId: () => 'note-1',
  ...overrides,
});

describe('Studio preserves MIDI from a failed mixed audio capture', () => {
  it('keeps original audio intact and finalizes held MIDI notes', () => {
    const oldAudio = { id: 1, type: 'audio', armed: true, waveform: [0.2, 0.8], audioUrl: 'blob:existing' };
    const midi = { id: 2, type: 'midi', armed: true, midiNotes: [{ id: 'old', startBeat: 1, durationBeats: 1 }] };
    const untouched = { id: 3, type: 'audio', armed: true, audioUrl: 'blob:other' };
    const tracks = [oldAudio, midi, untouched];
    const output = studioRecoverMidiOnAudioFailure(tracks, makeOptions());
    expect(output[0]).toEqual({ ...oldAudio, armed: false });
    expect(output[1].midiNotes).toEqual([
      { id: 'old', startBeat: 1, durationBeats: 1 },
      { id: 'note-1', note: 60, startBeat: 3, durationBeats: 2, velocity: 95 },
    ]);
    expect(output[1].armed).toBe(false);
    expect(output[2]).toBe(untouched);
    expect(tracks[1].midiNotes).toHaveLength(1);
  });

  it('does not fabricate MIDI data when no MIDI was recorded', () => {
    const midi = { id: 2, type: 'instrument', armed: true, midiNotes: [{ note: 70 }] };
    const output = studioRecoverMidiOnAudioFailure([midi], makeOptions({ stoppedMidiEnabled: false }));
    expect(output[0].midiNotes).toBe(midi.midiNotes);
    expect(output[0].armed).toBe(false);
  });

  it('clamps held-note duration and normalizes mixed numeric and string track IDs', () => {
    const midi = { id: '2', type: 'instrument', armed: true, midiNotes: [] };
    const output = studioRecoverMidiOnAudioFailure([midi], makeOptions({
      heldNotes: [{ trackId: 2, note: 64, startBeat: 5, velocity: 75 }],
    }));
    expect(output[0].midiNotes).toEqual([
      { id: 'note-1', note: 64, startBeat: 5, durationBeats: .25, velocity: 75 },
    ]);
  });

  it('uses the same MIDI recovery for both asynchronous finalization and synchronous stop failure', async () => {
    const source = await readFile('src/pages/Studio.jsx','utf8');
    const start = source.indexOf('console.error("Studio recording finalization failed", error)');
    const end = source.indexOf('    } else {', start);
    const block = source.slice(start,end);
    expect(block.match(/studioRecoverMidiOnAudioFailure\(prev, \{/g)).toHaveLength(2);
    expect(block.match(/if \(historyEpochRef.current !== stoppedSessionEpoch\) return prev;/g)).toHaveLength(2);
    expect(block.match(/heldNotes: stoppedMidiNotes/g)).toHaveLength(2);
  });
});
