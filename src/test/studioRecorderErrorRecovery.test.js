import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio recorder error event recovery', () => {
  it('attaches an encoder error handler before starting capture', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const start = source.indexOf('mediaRecorder.ondataavailable = (e) => {');
    const stop = source.indexOf('mediaRecorder.start(200)', start);
    const handler = source.slice(start, stop);
    expect(handler).toContain('mediaRecorder.onerror = event => {');
    expect(handler).toContain('recordingFinalizeInFlightRef.current');
    expect(handler).toContain('mediaRecorderRef.current !== mediaRecorder');
    expect(handler).toContain("mediaRecorder.state !== 'recording'");
    expect(handler).toContain('setIsRecording(false)');
    expect(handler).toContain('stopRecordingProcess()');
  });

  it('keeps last valid audio chunks and permits empty or absent error data', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const handler = source.slice(source.indexOf('mediaRecorder.ondataavailable = (e) => {'),
      source.indexOf('mediaRecorder.start(200)'));
    expect(handler).toContain('e.data?.size > 0');
    expect(handler).toContain('captureChunks.push(e.data)');
    expect(handler).toContain("event?.error?.message || 'Capture encoder interrupted'");
  });

  it('retains normal stopped-recorder completion after an inactive PCM error', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    expect(source).toContain('stoppedRecorder.onstop = async () => {');
    expect(source).toContain('new Blob(stoppedChunks, { type: recordingMimeType })');
  });
});
