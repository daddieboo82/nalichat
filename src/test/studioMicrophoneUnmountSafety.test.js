import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio pending microphone permission unmount safety', () => {
  it('invalidates pending permission and pre-roll requests on Studio unmount', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const effect = source.slice(source.indexOf('studioMountedRef.current = true;'),source.indexOf('mixEngineRef.current?.dispose();',source.indexOf('studioMountedRef.current = true;')));
    expect(effect).toContain('studioMountedRef.current = false');
    expect(effect).toContain('microphoneStartupRef.current.token += 1');
    expect(effect).toContain('microphoneStartupRef.current.pending = false');
    expect(effect).toContain('preRollRequestRef.current += 1');
    expect(effect).toContain('pendingRecordStartRef.current = null');
  });

  it('releases a stream arriving after the Studio component was unmounted', async () => {
    const source = await readFile('src/pages/Studio.jsx','utf8');
    const start = source.indexOf('startupStream = stream;');
    const end = source.indexOf('mediaStreamRef.current = stream;',start);
    const block = source.slice(start,end);
    expect(block).toContain('!studioMountedRef.current');
    expect(block).toContain('stream.getTracks().forEach(track => track.stop())');
    expect(block).toContain('return;');
  });

  it('does not set recording UI after rejected permission on unmounted Studio', async () => {
    const source = await readFile('src/pages/Studio.jsx','utf8');
    const start=source.indexOf('// An old permission response cannot reset a newer');
    const end=source.indexOf('} finally {',start);
    const block=source.slice(start,end);
    expect(block).toContain('if (studioMountedRef.current &&');
    expect(block).toContain('setIsRecording(false)');
    expect(block).toContain('setRecordingStartTime(null)');
  });
});
