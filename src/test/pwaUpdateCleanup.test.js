// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('PWA update cleanup', () => {
  it('ignores late registration resolution and removes installer listeners', async () => {
    const source = await readText('src/hooks/usePwaUpdate.js');
    expect(source).toContain('let disposed = false;');
    expect(source).toContain('if (disposed) return;');
    expect(source).toContain("installingWorker.removeEventListener('statechange', installingStateHandler)");
    expect(source).toContain('disposed = true;');
  });
});
