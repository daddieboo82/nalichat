// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('recording save upload validation', () => {
  it('validates the recorded File before secure upload', async () => {
    const source = await readFile('src/pages/Record.jsx', 'utf8');
    const validation = source.indexOf('validateUpload(file)');
    const upload = source.indexOf('secureUploadFile({ file })', validation);
    expect(validation).toBeGreaterThan(-1);
    expect(upload).toBeGreaterThan(validation);
    expect(source).toContain('Your local recording is still available.');
  });
});
