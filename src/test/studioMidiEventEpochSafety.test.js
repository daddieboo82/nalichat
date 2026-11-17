import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio live MIDI event callbacks are session-scoped', () => {
  it('prevents a permission response from attaching handlers after unmount', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const from = source.indexOf('midiAccess = await navigator.requestMIDIAccess');
    const to = source.indexOf('midiAccess.onstatechange', from);
    expect(source.slice(from, to)).toContain('if (!mounted) return;');
  });
  it('guards every queued MIDI state write using the event project epoch', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const from = source.indexOf('input.onmidimessage = (event) => {');
    const to = source.indexOf('                const [status, note, velocity]', from);
    const block = source.slice(from,to);
    expect(block).toContain('if (!mounted || !midiRecordingRef.current) return;');
    expect(block).toContain('const eventSessionEpoch = historyEpochRef.current');
    expect(block).toContain('if (!mounted || historyEpochRef.current !== eventSessionEpoch) return prev;');
  });
  it('routes note offs, sustain releases and CC/pitch-bend through the guarded updater', async () => {
    const source = await readFile('src/pages/Studio.jsx','utf8');
    const from = source.indexOf('input.onmidimessage = (event) => {');
    const to = source.indexOf('              };',from);
    const block = source.slice(from,to);
    expect(block).toContain('const appendEvent = (eventKey, eventData) =>');
    expect(block).toContain('updateMidiTrack(track.id');
    expect(block.match(/updateMidiTrack\(active.trackId/g)).toHaveLength(2);
    expect(block).toContain("appendEvent('midiPitchBend'");
    expect(block).toContain("appendEvent('midiCC'");
  });
  it('detaches device handlers and drops the previous MIDI access on unmount', async () => {
    const source=await readFile('src/pages/Studio.jsx','utf8');
    const from=source.indexOf('    return () => {\n      mounted = false;',source.indexOf('// Hardware Detection'));
    const to=source.indexOf('  }, []);',from);
    const block=source.slice(from,to);
    expect(block).toContain('input.onmidimessage = null');
    expect(block).toContain('midiAccessRef.current = null');
  });
});
