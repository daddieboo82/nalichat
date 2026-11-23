import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('authenticated Files E2E uses the visible upload workflow', () => {
  it('targets the direct mobile picker and preserves desktop dialog coverage', async () => {
    const source = await readFile('e2e/authenticated-smoke.spec.js', 'utf8');
    expect(source).toContain("page.getByLabel('Choose files to upload')");
    expect(source).toContain('await mobileUpload.setInputFiles(uploadFile)');
    expect(source).toContain("page.getByRole('button', { name: 'Upload files' }).click()");
    expect(source).toContain("page.getByTestId('files-upload-input').setInputFiles(uploadFile)");
  });
});