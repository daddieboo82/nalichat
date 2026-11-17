import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio MIDI detection independently of audio devices', () => {
  it('attempts MIDI even when enumerateDevices is not provided by the browser', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const block = source.slice(source.indexOf('const checkDevices = async () => {'),source.indexOf('    checkDevices();',source.indexOf('const checkDevices = async () => {')));
    expect(block).toContain('navigator.mediaDevices?.enumerateDevices');
    expect(block).toContain(': [];');
    expect(block).toContain('if (navigator.requestMIDIAccess)');
    expect(block).not.toContain('if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;');
  });
  it('handles audio hardware enumeration failure without skipping MIDI', async () => {
    const source = await readFile('src/pages/Studio.jsx','utf8');
    const block = source.slice(source.indexOf('const checkDevices = async () => {'),source.indexOf('    checkDevices();',source.indexOf('const checkDevices = async () => {')));
    const error = block.indexOf('Audio hardware enumeration failed; MIDI detection will still run');
    const midi = block.indexOf('if (navigator.requestMIDIAccess)');
    expect(error).toBeGreaterThan(0);
    expect(midi).toBeGreaterThan(error);
  });
  it('clears failed MIDI permission requests to allow a new attempt', async () => {
    const source = await readFile('src/pages/Studio.jsx','utf8');
    const block = source.slice(source.indexOf('const checkDevices = async () => {'),source.indexOf('    checkDevices();',source.indexOf('const checkDevices = async () => {')));
    expect(block).toContain('midiAccessRequest ||= navigator.requestMIDIAccess({ sysex: false });');
    expect(block).toMatch(/catch \(e\) \{\s*\/\/ A failed permission request must not poison later retries\.\s*midiAccessRequest = null;/);
  });
});
