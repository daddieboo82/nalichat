import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio recording startup failure cleanup', () => {
  it('tracks each acquired resource from permission through recorder startup', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const start = source.indexOf('let startupStream = null;');
    const end = source.indexOf('} else {\n      setIsRecording(false);', start);
    const block = source.slice(start,end);
    expect(block).toContain('startupStream = stream;');
    expect(block).toContain('startupContext = audioCtx;');
    expect(block).toContain('startupRecorder = mediaRecorder;');
    expect(block).toContain("startupStream.getTracks().forEach(track => track.stop())");
    expect(block).toContain('await startupContext.close()');
    expect(block).toContain("startupRecorder.ondataavailable = null");
  });
  it('does not clear refs belonging to a different capture, and resets transport indicators', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const start = source.indexOf('} catch (err) {\n        // Permission may have succeeded');
    const end = source.indexOf('    } else {\n      setIsRecording(false);', start);
    const block = source.slice(start,end);
    expect(block).toContain('mediaRecorderRef.current === startupRecorder');
    expect(block).toContain('audioContextRef.current === startupContext');
    expect(block).toContain('mediaStreamRef.current === startupStream');
    expect(block).toContain('setIsRecording(false)');
    expect(block).toContain('setRecordingStartTime(null)');
    expect(block).toContain('audio.pause()');
    expect(block).not.toContain('waveform: []');
  });
});
