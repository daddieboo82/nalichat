// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('microphone monitor start race', () => {
  it('invalidates late getUserMedia results after stop or a newer start', async () => {
    const source = await readText('src/hooks/useMicMonitor.js');
    expect(source).toContain('const startRequestRef = useRef(0);');
    expect(source).toContain('startRequestRef.current += 1;');
    expect(source).toContain('const requestId = ++startRequestRef.current;');
    expect(source).toContain('if (requestId !== startRequestRef.current)');
    expect(source).toContain('stream.getTracks().forEach((track) => track.stop());');
  });
});
