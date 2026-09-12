// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('WebRTC call media setup cancellation', () => {
  it('invalidates pending getUserMedia when call cleanup supersedes setup', async () => {
    const engine = await readText('src/lib/callEngine.js');
    expect(engine).toContain('this.operationGeneration = 0;');
    expect(engine).toContain('const generation = ++this.operationGeneration;');
    expect(engine).toContain('if (generation !== this.operationGeneration)');
    expect(engine).toContain('stream.getTracks().forEach((track) => track.stop());');
    expect(engine).toContain('this.operationGeneration += 1;');
  });

  it('does not show failure toasts for intentional setup cancellation', async () => {
    const hook = await readText('src/hooks/useCall.js');
    expect(hook).toContain('if (e?.name === "AbortError") return;');
  });
});
