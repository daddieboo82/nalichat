// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('mic monitor startup cleanup', () => {
  it('releases acquired media resources when setup fails after getUserMedia succeeds', async () => {
    const source = await readText('src/hooks/useMicMonitor.js');
    expect(source).toContain('let acquiredStream = null;');
    expect(source).toContain('let acquiredAudioCtx = null;');
    expect(source).toContain("if (!AudioContext) throw new Error('Web Audio is not supported in this browser')");
    expect(source).toContain('acquiredStream?.getTracks().forEach((track) => track.stop());');
    expect(source).toContain("if (acquiredAudioCtx && acquiredAudioCtx.state !== 'closed')");
    expect(source).toContain('setMonitoring(false);');
    expect(source).toContain('setLevel(0);');
  });
});
