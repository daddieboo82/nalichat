import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio pending microphone permission cancellation', () => {
  it('prevents multiple simultaneous permission requests', async () => {
    const src = await readFile('src/pages/Studio.jsx','utf8');
    const block = src.slice(src.indexOf('const toggleRecord = async () => {'), src.indexOf('// Pro Tools count-in:',src.indexOf('const toggleRecord = async () => {')));
    expect(block).toContain('microphoneStartupRef.current.pending');
    expect(src).toContain('microphoneStartupRef.current.pending = true;');
  });
  it('releases a late stream if stopped or project epoch has changed', async () => {
    const src = await readFile('src/pages/Studio.jsx','utf8');
    const start = src.indexOf('const startupToken = ++microphoneStartupRef.current.token;');
    const end = src.indexOf('// Overdub: play back existing',start);
    const block = src.slice(start,end);
    expect(block).toContain('const startupEpoch = historyEpochRef.current');
    expect(block).toContain('microphoneStartupRef.current.token !== startupToken');
    expect(block).toContain('historyEpochRef.current !== startupEpoch');
    expect(block).toContain('stream.getTracks().forEach(track => track.stop())');
    expect(block.indexOf('stream.getTracks().forEach(track => track.stop())')).toBeLessThan(block.indexOf('mediaStreamRef.current = stream'));
  });
  it('invalidates permission request on transport Stop and only resets current UI', async () => {
    const src = await readFile('src/pages/Studio.jsx','utf8');
    const stop = src.slice(src.indexOf('const stop = () => {'), src.indexOf('// Called when the count-in overlay'));
    expect(stop).toContain('microphoneStartupRef.current.token += 1');
    const catchBlock = src.slice(src.indexOf('// An old permission response cannot reset'),src.indexOf('    } else {\n      setIsRecording(false)',src.indexOf('// An old permission response cannot reset')));
    expect(catchBlock).toContain('microphoneStartupRef.current.token === startupToken');
    expect(catchBlock).toContain('historyEpochRef.current === startupEpoch');
    expect(catchBlock).toContain('microphoneStartupRef.current.pending = false;');
  });
});
