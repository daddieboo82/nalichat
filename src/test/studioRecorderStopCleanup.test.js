import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio MediaRecorder teardown safety', () => {
  it('clears only the finished recorder after async finalization', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const start = source.indexOf('stoppedRecorder.onstop = async () => {');
    const end = source.indexOf('stoppedRecorder.stop();', start);
    const handler = source.slice(start,end);
    expect(handler).toContain('if (mediaRecorderRef.current === stoppedRecorder) {');
    expect(handler).toContain('mediaRecorderRef.current = null;');
    expect(handler).toContain('recordingFinalizeInFlightRef.current = false;');
  });
  it('handles synchronous stop errors without throwing or overwriting old tracks', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const start = source.indexOf('stoppedRecorder.stop();');
    const end = source.indexOf('    } else {',start);
    const block = source.slice(start,end);
    expect(block).toContain('stoppedRecorder.onstop = null;');
    expect(block).toContain('recordingFinalizeInFlightRef.current = false;');
    expect(block).toContain('if (historyEpochRef.current === stoppedSessionEpoch)');
    expect(block).toContain('stoppedArmedIds.has(String(track.id)) ? { ...track, armed: false } : track');
    expect(block).not.toContain('throw error');
  });
});
