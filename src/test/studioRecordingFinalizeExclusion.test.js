import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio recording finalization exclusion', () => {
  it('prevents another recording while the preceding stopped take is being finalized', async () => {
    const source = await readFile('src/pages/Studio.jsx','utf8');
    const start = source.indexOf('const toggleRecord = async () => {');
    const end = source.indexOf('if (!isRecording && !tracks.some(t => t.armed))', start);
    expect(source.slice(start,end)).toContain('if (!isRecording && recordingFinalizeInFlightRef.current)');
    expect(source).toContain('recordingFinalizeInFlightRef.current = true;');
    expect(source).toContain('recordingFinalizeInFlightRef.current = false;');
  });

  it('always releases finalization lock on callback completion, failure, or stopped recorder exception', async () => {
    const source = await readFile('src/pages/Studio.jsx','utf8');
    const start = source.indexOf('stoppedRecorder.onstop = async () => {');
    const end = source.indexOf('    } else {', source.indexOf('stoppedRecorder.stop();', start));
    const handler = source.slice(start,end);
    expect(handler).toContain('try {');
    expect(handler).toContain('} finally {\n          // If finalization failed before ownership passed to a track');
    expect(handler).toContain('recordingFinalizeInFlightRef.current = false;');
    expect(handler).toContain('stoppedRecorder.stop();');
    expect(handler).toContain('catch (error) {\n        console.error("Studio MediaRecorder stop failed", error);');
    expect(handler).toContain('stoppedRecorder.onstop = null;');
  });

  it('uses a dedicated chunk array in each recorder callback instead of mutable shared ref', async () => {
    const source = await readFile('src/pages/Studio.jsx','utf8');
    const start = source.indexOf('const { recorder: mediaRecorder, lossless } = createStudioMediaRecorder(stream, MediaRecorder)');
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf('mediaRecorder.start(200)',start);
    const setup = source.slice(start,end);
    expect(setup).toContain('const captureChunks = []');
    expect(setup).toContain('audioChunksRef.current = captureChunks');
    expect(setup).toContain('captureChunks.push(e.data)');
    expect(setup).not.toContain('audioChunksRef.current.push(e.data)');
  });
});
