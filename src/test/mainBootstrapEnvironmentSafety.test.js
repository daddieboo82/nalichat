import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('main bootstrap environment safety', () => {
  it('guards navigator before service-worker access', async () => {
    const source = await readFile('src/main.jsx', 'utf8');
    expect(source).toContain("typeof navigator !== 'undefined' && 'serviceWorker' in navigator");
    expect(source).not.toContain("if ('serviceWorker' in navigator) {");
  });
});
