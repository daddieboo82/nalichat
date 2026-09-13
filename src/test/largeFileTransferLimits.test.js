// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('large file transfer supported limits', () => {
  it('does not advertise unsupported 20GB resumable uploads', async () => {
    const source = await readFile('src/components/files/LargeFileTransfer.jsx', 'utf8');
    expect(source).not.toContain('20 * 1024 * 1024 * 1024');
    expect(source).not.toContain('Up to 20GB per file');
    expect(source).not.toContain('Resume uploads anytime');
    expect(source).not.toContain('uploads resume automatically');
    expect(source).toContain('validateUpload(selectedFile)');
  });
});
