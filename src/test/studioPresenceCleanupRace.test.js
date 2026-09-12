// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('studio presence cleanup', () => {
  it('clears presence immediately on cleanup instead of scheduling a stale delayed clear', async () => {
    const source = await readText('src/hooks/useStudioPresence.js');
    expect(source).toContain('void base44.functions.invoke("updateStudioPresence"');
    expect(source).toContain('action: "clear"');
    expect(source).not.toContain('setTimeout(() => {\n        base44.functions.invoke("updateStudioPresence"');
    expect(source).not.toContain('}, 2000);');
  });
});
