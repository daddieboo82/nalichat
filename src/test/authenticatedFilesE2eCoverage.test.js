// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('authenticated Files E2E coverage', () => {
  it('exposes a stable upload input and exercises production upload', async () => {
    const files = await readFile('src/pages/Files.jsx', 'utf8');
    const e2e = await readFile('e2e/authenticated-smoke.spec.js', 'utf8');
    expect(files).toContain('data-testid="files-upload-input"');
    expect(e2e).toContain("uploads and surfaces a small file in Files");
    expect(e2e).toContain("setInputFiles({");
    expect(e2e).toContain("NaliChat production E2E upload check");
  });
});
