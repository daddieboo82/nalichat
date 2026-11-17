import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio MIDI device hotplug bindings', () => {
  it('shares one pending MIDI permission request across overlapping device scans', async () => {
    const src = await readFile('src/pages/Studio.jsx', 'utf8');
    const section = src.slice(src.indexOf('// Hardware Detection'), src.indexOf('const stopRecordingProcess ='));
    expect(section).toContain('let midiAccessRequest = null;');
    expect(section).toContain('midiAccessRequest ||= navigator.requestMIDIAccess({ sysex: false });');
    expect(section).toContain('midiAccess = await midiAccessRequest;');
  });
  it('registers newly connected MIDI inputs when device state changes', async () => {
    const src = await readFile('src/pages/Studio.jsx', 'utf8');
    const section = src.slice(src.indexOf('// Hardware Detection'), src.indexOf('const stopRecordingProcess ='));
    expect(section).toContain('const bindMidiInputs = () => {');
    expect(section).toContain('if (midiInputsBound.has(input)) return;');
    expect(section).toContain('midiInputsBound.add(input);');
    expect(section).toContain('midiAccess.onstatechange = (e) => {\n                if (!mounted) return;\n                bindMidiInputs();');
  });
  it('cleans up every registered input, including disconnected ones, on Studio unmount', async () => {
    const src = await readFile('src/pages/Studio.jsx','utf8');
    const section = src.slice(src.indexOf('// Hardware Detection'),src.indexOf('const stopRecordingProcess ='));
    expect(section).toContain('midiInputsBound.forEach(input => { input.onmidimessage = null; });');
    expect(section).toContain('midiInputsBound.clear();');
  });
});
