// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('Cover Art upload validation', () => {
  it('validates imported media and replacement art before secure upload', async () => {
    const source = await readFile('src/pages/CoverArt.jsx','utf8');
    expect(source.match(/validateUpload\(file\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(source.match(/toast\.error\(validation\.error\)/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
