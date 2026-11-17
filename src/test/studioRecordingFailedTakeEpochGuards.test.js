import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio failed recording mutations remain in stopped session', () => {
  it('rejects a queued empty-take disarm when its project epoch was replaced', async () => {
    const src = await readFile('src/pages/Studio.jsx', 'utf8');
    const from = src.indexOf('if (blob.size === 0)');
    const to = src.indexOf('if (historyEpochRef.current === stoppedSessionEpoch)', from);
    const block = src.slice(from, to);
    expect(block).toContain('setTracksWithHistory(prev => {');
    expect(block).toContain('if (historyEpochRef.current !== stoppedSessionEpoch) return prev;');
    expect(block).toContain('stoppedArmedIds.has(String(t.id))');
  });
  it('guards the asynchronous failure cleanup updater against a session switch', async () => {
    const src = await readFile('src/pages/Studio.jsx', 'utf8');
    const from = src.indexOf('console.error("Studio recording finalization failed", error)');
    const to = src.indexOf('} finally {', from);
    const block = src.slice(from, to);
    expect(block).toContain('setTracksWithHistory(prev => {');
    expect(block).toContain('if (historyEpochRef.current !== stoppedSessionEpoch) return prev;');
    expect(block).toContain('armedIds: stoppedArmedIds');
    expect(block).toContain('heldNotes: stoppedMidiNotes');
  });
  it('guards synchronous MediaRecorder.stop failure cleanup before applying queued updates', async () => {
    const src = await readFile('src/pages/Studio.jsx', 'utf8');
    const from = src.indexOf('console.error("Studio MediaRecorder stop failed", error)');
    const to = src.indexOf('    } else {', from);
    const block = src.slice(from, to);
    expect(block).toContain('setTracksWithHistory(prev => {');
    expect(block).toContain('if (historyEpochRef.current !== stoppedSessionEpoch) return prev;');
    expect(block).toContain('armedIds: stoppedArmedIds');
    expect(block).toContain('heldNotes: stoppedMidiNotes');
  });
});
