// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('Studio project save upload validation', () => {
  it('validates local blob tracks before making them portable', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const validation = source.indexOf('validateUpload(file)');
    const upload = source.indexOf('secureUploadFile({ file })', validation);
    expect(validation).toBeGreaterThan(-1);
    expect(upload).toBeGreaterThan(validation);
    expect(source).toContain('track.name || "Track"');
    expect(source).toContain('validation.error');
  });
});
