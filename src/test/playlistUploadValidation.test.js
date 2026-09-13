// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('playlist upload validation', () => {
  it('validates selected tracks before invoking the secure upload gateway', async () => {
    const source = await readFile('src/pages/PlaylistDetail.jsx', 'utf8');
    expect(source).toContain('validateUpload(file)');
    expect(source).toContain('if (!validation.ok)');
    expect(source.indexOf('validateUpload(file)')).toBeLessThan(source.indexOf('uploadMutation.mutate(file)'));
  });
});
