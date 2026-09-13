// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Explore release upload selection validation', () => {
  it('validates cover and audio selections before publish begins', async () => {
    const source = await readFile('src/components/explore/UploadArtDialog.jsx', 'utf8');
    expect(source.match(/validateUpload\(f\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(source.match(/toast\.error\(validation\.error\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(source.match(/e\.target\.value = ""/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
