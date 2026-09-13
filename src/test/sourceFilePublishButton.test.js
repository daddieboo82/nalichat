import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('source-file publish button', () => {
  it('allows publishing when an existing Files URL supplies the required audio', async () => {
    const s = await readFile('src/components/explore/UploadArtDialog.jsx', 'utf8');
    expect(s).toContain('disabled={loading || !form.title || (!audioFile && !sourceFile?.file_url)}');
  });
});
