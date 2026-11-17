import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { isCurrentStudioHardwareScan } from '../lib/studioHardwareScan.js';

describe('Studio asynchronous hardware scan ordering', () => {
  it('only allows the latest mounted hardware scan to publish', () => {
    expect(isCurrentStudioHardwareScan(1, 2, true)).toBe(false);
    expect(isCurrentStudioHardwareScan(2, 2, true)).toBe(true);
    expect(isCurrentStudioHardwareScan(2, 2, false)).toBe(false);
  });
  it('rejects stale results after audio enumeration before doing MIDI setup', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const from = source.indexOf('const checkDevices = async () => {');
    const to = source.indexOf('    checkDevices();', from);
    const block = source.slice(from,to);
    expect(block).toContain('const hardwareScan = ++latestHardwareScan;');
    expect(block.match(/if \(!isCurrentStudioHardwareScan\(hardwareScan, latestHardwareScan, mounted\)\) return;/g)).toHaveLength(2);
  });
  it('commits hardware indicators only from current scan using live MIDI input count', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const from=source.indexOf('const checkDevices = async () => {');
    const to=source.indexOf('    checkDevices();',from);
    const block=source.slice(from,to);
    expect(block).toContain('if (isCurrentStudioHardwareScan(hardwareScan, latestHardwareScan, mounted)) {');
    expect(block).toContain('midi: midiAccess ? midiAccess.inputs.size > 0 : hasMidi');
  });
  it('invalidates unfinished device scans when Studio unmounts', async () => {
    const source=await readFile('src/pages/Studio.jsx','utf8');
    const from=source.indexOf('return () => {\n      mounted = false;', source.indexOf('// Hardware Detection'));
    const to=source.indexOf('  }, []);',from);
    expect(source.slice(from,to)).toContain('latestHardwareScan += 1');
  });
});
