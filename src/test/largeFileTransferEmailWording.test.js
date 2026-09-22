import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('large file transfer recipient messaging', () => {
  it('does not imply NaliBase emailed a generated share link', async () => {
    const s = await readFile('src/components/files/LargeFileTransfer.jsx', 'utf8');
    expect(s).toContain('NaliBase does not email the link automatically.');
    expect(s).toContain('Copy the link and send it to');
    expect(s).not.toContain('check their messages');
  });
});
