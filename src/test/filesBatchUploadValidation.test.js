// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Files batch upload validation', () => {
  it('filters invalid files before starting a batch upload', async () => {
    const source = await readFile('src/pages/Files.jsx', 'utf8');
    expect(source).toContain('const validation = validateUpload(file);');
    expect(source).toContain('if (validation.ok) validFiles.push(file);');
    expect(source).toContain('if (validFiles.length > 0) uploadMutation.mutate(validFiles);');
  });
});
