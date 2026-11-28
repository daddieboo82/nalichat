import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio recorded blob URL ownership', () => {
  it('tracks the allocated transient URL until a recording is queued on tracks', async () => {
    const src = await readFile('src/pages/Studio.jsx','utf8');
    const start = src.indexOf('stoppedRecorder.onstop = async () => {');
    const end = src.indexOf('stoppedRecorder.stop();',start);
    const handler = src.slice(start,end);
    expect(handler).toContain('let transientRecordedUrl = null;');
    expect(handler).toContain('let recordedUrlTransferred = false;');
    expect(handler).toContain('transientRecordedUrl = audioUrl;');
    expect(handler.indexOf('recordedUrlTransferred = true;')).toBeGreaterThan(handler.indexOf('setTracksWithHistory(prev => {\n          if (historyEpochRef.current !== stoppedSessionEpoch)'));
  });

  it('releases a temporary recording URL on early exit or exception', async () => {
    const src = await readFile('src/pages/Studio.jsx','utf8');
    const start = src.indexOf('stoppedRecorder.onstop = async () => {');
    const end = src.indexOf('stoppedRecorder.stop();',start);
    const handler = src.slice(start,end);
    expect(handler).toContain('} finally {');
    expect(handler).toContain('// If finalization failed before ownership passed to a track');
    expect(handler).toContain('if (transientRecordedUrl && !recordedUrlTransferred)');
    expect(handler).toContain('URL.revokeObjectURL(transientRecordedUrl);');
    expect(handler).toContain('if (historyEpochRef.current !== stoppedSessionEpoch) return;');
  });

  it('rejects a project-changed deferred state update without attaching stale audio', async () => {
    const src = await readFile('src/pages/Studio.jsx','utf8');
    const start = src.indexOf('// Once a take is queued for track ownership');
    const end = src.indexOf('recordedUrlTransferred = true;',start);
    const block = src.slice(start,end);
    expect(block).toContain('if (historyEpochRef.current !== stoppedSessionEpoch)');
    expect(block).toContain('URL.revokeObjectURL(audioUrl)');
    expect(block).toContain('return prev;');
  });
});
