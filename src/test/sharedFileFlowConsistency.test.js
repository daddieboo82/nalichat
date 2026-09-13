// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('shared file flow consistency', () => {
  it('validates shared download media fields before showing a ready state', async () => {
    const source = await readFile('src/pages/SharedFileDownload.jsx', 'utf8');
    expect(source).toContain('typeof sharedFile?.file_url !== "string"');
    expect(source).toContain('!sharedFile.file_url.trim()');
    expect(source).toContain('typeof sharedFile?.name !== "string"');
    expect(source).toContain('!sharedFile.name.trim()');
  });

  it('requires secure token format and future expiry for large-file transfer links', async () => {
    const source = await readFile('src/components/files/LargeFileTransfer.jsx', 'utf8');
    expect(source).toContain('/^[0-9a-f]{64}$/i.test(token)');
    expect(source).toContain('!Number.isFinite(expiresAtMs)');
    expect(source).toContain('expiresAtMs <= Date.now()');
  });
});
