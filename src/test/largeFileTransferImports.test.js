// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('LargeFileTransfer imports', () => {
  it('uses Nali Transfer without the legacy upload validator', async () => {
    const source = await readFile('src/components/files/LargeFileTransfer.jsx', 'utf8');
    expect(source).toContain('import { resumableUpload } from "@/lib/resumableUpload";');
    expect(source).not.toContain('import { validateUpload } from "@/lib/uploadValidation";');
    expect(source).not.toContain('formatBytes');
  });
});
