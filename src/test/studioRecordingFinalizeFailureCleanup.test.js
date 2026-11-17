import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio recording finalization cleanup after error', () => {
  it('disarms only the failed recording targets without modifying existing clips', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const start = source.indexOf('console.error("Studio recording finalization failed"');
    const end = source.indexOf('} finally {\n          recordingFinalizeInFlightRef.current = false;', start);
    const block = source.slice(start,end);
    expect(block).toContain('if (historyEpochRef.current === stoppedSessionEpoch)');
    expect(block).toContain('stoppedArmedIds.has(String(track.id)) ? { ...track, armed: false } : track');
    expect(block).toContain('setRecordingStartTime(null)');
    expect(block).not.toContain('waveform: []');
    expect(block).not.toContain('audioUrl:');
  });
  it('guards empty and successful completion UI changes from older project callbacks', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const from = source.indexOf('stoppedRecorder.onstop = async () => {');
    const to = source.indexOf('stoppedRecorder.stop();',from);
    const block = source.slice(from,to);
    expect(block.match(/if \(historyEpochRef.current === stoppedSessionEpoch\) \{\s*setRecordingStartTime\(null\);/g)).toHaveLength(2);
  });
});
