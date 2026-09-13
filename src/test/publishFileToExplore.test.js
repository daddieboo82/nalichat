import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('publish Files track to Explore', () => {
  it('carries the selected stored file into the Explore release dialog', async () => {
    const files = await readFile('src/pages/Files.jsx', 'utf8');
    const explore = await readFile('src/pages/Explore.jsx', 'utf8');
    const upload = await readFile('src/components/explore/UploadArtDialog.jsx', 'utf8');
    expect(files).toContain("state: { publishFile: file }");
    expect(explore).toContain('sourceFile={publishFile}');
    expect(upload).toContain('(!audioFile && !sourceFile?.file_url)');
    expect(upload).toContain('let file_url = sourceFile?.file_url || null;');
    expect(upload).toContain('Publishing from Files:');
  });
});
