import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio delayed MediaRecorder completion isolation', () => {
  it('snapshots the stopped recorder, chunk array, destinations and timeline', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const from = source.indexOf('if (mediaRecorderRef.current && mediaRecorderRef.current.state !==');
    const to = source.indexOf('    } else {', source.indexOf('stoppedRecorder.stop();', from));
    const handler = source.slice(from, to);
    expect(handler).toContain('const stoppedRecorder = mediaRecorderRef.current');
    expect(handler).toContain('const stoppedChunks = audioChunksRef.current');
    expect(handler).toContain('const stoppedArmedIds = new Set(');
    expect(handler).toContain('const stoppedStartTime =');
    expect(handler).toContain('const stoppedEndTime =');
    expect(handler).toContain('new Blob(stoppedChunks, { type: recordingMimeType })');
    expect(handler).toContain('stoppedRecorder.stop()');
    expect(handler).not.toContain('new Blob(audioChunksRef.current');
  });

  it('rejects results from a different project session before saving tracks', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const from = source.indexOf('const stoppedSessionEpoch = historyEpochRef.current');
    const to = source.indexOf('stoppedRecorder.stop()',from);
    const handler = source.slice(from,to);
    expect(handler).toContain('if (historyEpochRef.current !== stoppedSessionEpoch) return;');
    expect(handler).toContain('URL.revokeObjectURL(audioUrl)');
    expect(handler).toContain('if (historyEpochRef.current !== stoppedSessionEpoch) {\n            URL.revokeObjectURL(audioUrl);\n            return prev;');
  });

  it('uses captured track destinations and original recording start for every take', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const from = source.indexOf('const stoppedSessionEpoch = historyEpochRef.current');
    const to = source.indexOf('stoppedRecorder.stop()',from);
    const handler = source.slice(from,to);
    expect(handler).toContain("stoppedArmedIds.has(String(prev[index].id))");
    expect(handler).toContain('startTime: stoppedStartTime');
    expect(handler).toContain('Math.max(1, stoppedEndTime - stoppedStartTime)');
    expect(handler).toContain('stoppedRecorder.mimeType');
  });
});
