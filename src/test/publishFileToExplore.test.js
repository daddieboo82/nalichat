import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('publish Files track to Explore', () => {
  it('carries the selected stored file into the Explore release dialog', async () => {
    const files = await readFile('src/pages/Files.jsx', 'utf8');
    const explore = await readFile('src/pages/Explore.jsx', 'utf8');
    const upload = await readFile('src/components/explore/UploadArtDialog.jsx', 'utf8');
    expect(explore).toContain('location.state?.publishFile');
    expect(explore).toContain('sourceFile={publishFile}');
    expect(upload).toContain('(!audioFile && !sourceFile?.file_url)');
    expect(upload).toContain('let file_url = sourceFile?.file_url || null;');
    expect(upload).toContain('Publishing from Files:');
  });
});


  it('keeps the generic Files publish button free of an undefined file reference', async () => {
    const files = await readFile('src/pages/Files.jsx', 'utf8');
    expect(files).toContain("onClick={() => navigate('/explore?upload=true')}");
    expect(files).not.toContain("navigate('/explore?upload=true', { state: { publishFile: file } })");
  });
