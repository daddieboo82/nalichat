import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio delete and Undo cached audio cleanup', () => {
  it('detaches deleted audio so Undo rehydrates its original media and mixer graph', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const start = source.indexOf('const deleteTrack = (trackId) => {');
    const end = source.indexOf('const duplicateTrack = (track) => {', start);
    const body = source.slice(start, end);
    expect(body).toContain("audioElementsRef.current[trackId].removeAttribute('src')");
    expect(body).toContain('delete audioElementsRef.current[trackId]');
    expect(body).toContain('mixEngineRef.current?.detach(trackId)');
    expect(body).toContain('playbackStartingRef.current.delete(trackId)');
    expect(body).toContain('playbackFailedRef.current.delete(trackId)');
    expect(body).not.toContain('URL.revokeObjectURL');
    expect(body.indexOf('delete audioElementsRef.current[trackId]')).toBeLessThan(body.indexOf('mixEngineRef.current?.detach(trackId)'));
  });
  it('still recreates cached players when source URLs change', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    expect(source).toContain('if (!audio || audio.dataset?.srcUrl !== track.audioUrl)');
    expect(source).toContain('audioElementsRef.current[track.id] = audio');
  });
});
