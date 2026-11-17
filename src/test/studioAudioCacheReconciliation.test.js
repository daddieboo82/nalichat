import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio audio-player reconciliation after edits and Undo/Redo', () => {
  it('removes cached audio players absent from the current track state or with obsolete media', async () => {
    const code = await readFile('src/pages/Studio.jsx','utf8');
    const start = code.indexOf('// Reconcile media elements after edits');
    const end = code.indexOf('// Sync mixer state (fader',start);
    const block = code.slice(start,end);
    expect(start).toBeGreaterThan(0);
    expect(block).toContain('new Map(tracks.map(track => [String(track.id), track]))');
    expect(block).toContain("audio.dataset?.srcUrl === track.audioUrl");
    expect(block).toContain('audio.pause()');
    expect(block).toContain('mixEngineRef.current?.detach(id)');
    expect(block).toContain('delete audioElementsRef.current[id]');
    expect(block).toContain('playbackStartingRef.current.delete(id)');
    expect(block).toContain('playbackFailedRef.current.delete(id)');
    expect(block).toContain('}, [tracks]);');
  });
  it('does not reuse an obsolete player when RAF starts a newly active split clip', async () => {
    const code = await readFile('src/pages/Studio.jsx', 'utf8');
    const start = code.indexOf('// Transport crossing:');
    const end = code.indexOf('if (isRecording && recordingStartTime', start);
    const block = code.slice(start,end);
    expect(block).toContain('audio?.dataset?.srcUrl === track.audioUrl');
    expect(block).toContain('getTrackAudioRef.current?.(track)');
  });
});
