// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('studio presence stale refresh protection', () => {
  it('ignores refresh responses from superseded room/effect generations', async () => {
    const source = await readText('src/hooks/useStudioPresence.js');
    expect(source).toContain('const refreshGenerationRef = useRef(0);');
    expect(source).toContain('const generation = ++refreshGenerationRef.current;');
    expect(source).toContain('generation !== refreshGenerationRef.current');
    expect(source).toContain('refreshGenerationRef.current += 1;');
    expect(source).toContain('setInterval(() => refresh(generation), 5000)');
  });
});
