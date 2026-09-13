// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('LargeFileTransfer imports', () => {
  it('does not retain the unused formatBytes import', async () => {
    const source = await readFile('src/components/files/LargeFileTransfer.jsx', 'utf8');
    expect(source).toContain('import { validateUpload } from "@/lib/uploadValidation";');
    expect(source).not.toContain('formatBytes');
  });
});
