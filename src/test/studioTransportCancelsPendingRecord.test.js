import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio playback supersedes queued record punch-in', () => {
  it('cancels an outstanding pre-roll marker before normal Play/Pause', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const start = source.indexOf('const togglePlay = async');
    const end = source.indexOf('// Each Play/Pause action invalidates',start);
    const block = source.slice(start,end);
    expect(block).toContain('pendingRecordStartRef.current !== null');
    expect(block).toContain('preRollRequestRef.current += 1;');
    expect(block).toContain('pendingRecordStartRef.current = null;');
    expect(block).toContain('skipPreRollRef.current = false;');
  });
  it('cancels count-in and prevents a stale one-shot recording bypass', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const start = source.indexOf('const togglePlay = async');
    const end = source.indexOf('// Each Play/Pause action invalidates',start);
    const block = source.slice(start,end);
    expect(block).toContain('countInActive');
    expect(block).toContain('skipCountInRef.current = false;');
    expect(block).toContain('setCountInActive(false);');
  });
  it('still invalidates the normal playback attempt after canceling pending recording', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const start = source.indexOf('const togglePlay = async');
    const end = source.indexOf('if (isRecording)', start);
    const block = source.slice(start,end);
    expect(block.indexOf('pendingRecordStartRef.current = null;')).toBeLessThan(block.indexOf('++playbackAttemptRef.current'));
  });
});
