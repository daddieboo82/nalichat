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

  it('recovers spontaneous browser stops after the last data chunk without stopping twice', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const startup = source.slice(source.indexOf('mediaRecorder.ondataavailable = (e) => {'),
      source.indexOf('mediaRecorder.start(200)'));
    expect(startup).toContain('mediaRecorder.onstop = () => {');
    expect(startup).toContain('recordingFinalizeInFlightRef.current');
    expect(startup).toContain('mediaRecorderRef.current !== mediaRecorder');
    expect(startup).toContain('stopRecordingProcess(false, true)');
    const finalize = source.slice(source.indexOf('const stopRecordingProcess ='),
      source.indexOf('const toggleRecord ='));
    expect(finalize).toContain('recorderAlreadyStopped = false');
    expect(finalize).toContain("mediaRecorderRef.current.state !== 'inactive' || recorderAlreadyStopped");
    expect(finalize).toContain('if (recorderAlreadyStopped) void stoppedRecorder.onstop();');
    expect(finalize).toContain('else stoppedRecorder.stop();');
    expect(finalize).toContain('const stoppedChunks = audioChunksRef.current;');
    expect(finalize).toContain('new Blob(stoppedChunks, { type: recordingMimeType })');
  });

  it('disables recorder event callbacks before cleaning up a failed startup', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const cleanup = source.slice(source.indexOf('if (startupRecorder) {'),
      source.indexOf('if (startupContext) {', source.indexOf('if (startupRecorder) {')));
    expect(cleanup).toContain('startupRecorder.onstop = null;');
    expect(cleanup).toContain('startupRecorder.onerror = null;');
    expect(cleanup).toContain('startupRecorder.ondataavailable = null;');
  });

  it('retains normal stopped-recorder completion after an inactive PCM error', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    expect(source).toContain('stoppedRecorder.onstop = async () => {');
    expect(source).toContain('new Blob(stoppedChunks, { type: recordingMimeType })');
  });
});
