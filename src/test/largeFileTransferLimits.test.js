// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Nali Transfer size policy', () => {
  it('does not impose the legacy NaliChat total file-size ceilings', async () => {
    const ui = await readFile('src/components/files/LargeFileTransfer.jsx', 'utf8');
    const backend = await readFile('base44/functions/createSharedFileRecord/entry.ts', 'utf8');

    expect(ui).not.toContain('validateUpload(selectedFile)');
    expect(ui).not.toContain('Up to 20GB per file');
    expect(backend).not.toContain('PREMIUM_FILE_LIMIT');
    expect(backend).not.toContain('FREE_FILE_LIMIT');
    expect(backend).not.toContain('Premium is required for files larger than 250MB');
    expect(backend).not.toContain('Files larger than 20GB are not supported');
    expect(backend).toContain('No NaliChat total-size ceiling');
  });
});
