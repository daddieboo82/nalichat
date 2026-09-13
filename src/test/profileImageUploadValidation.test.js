// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('profile image upload validation', () => {
  it('validates Profile avatar and cover before upload', async () => {
    const source = await readFile('src/pages/Profile.jsx', 'utf8');
    expect(source.match(/validateUpload\(file\)/g)?.length).toBeGreaterThanOrEqual(2);
  });
  it('validates Settings avatar before upload', async () => {
    const source = await readFile('src/pages/Settings.jsx', 'utf8');
    expect(source).toContain('validateUpload(file)');
    expect(source).toContain('toast.error(validation.error)');
  });
});
