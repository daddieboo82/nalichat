// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('subscription upload capability claims', () => {
  it('does not advertise unsupported 20GB uploads', async () => {
    const catalog = await readFile('src/lib/subscriptionCatalog.js', 'utf8');
    const transfer = await readFile('src/components/files/LargeFileTransfer.jsx', 'utf8');
    expect(catalog).not.toContain('20GB');
    expect(transfer).not.toContain('20GB');
    expect(catalog).toContain('Premium file transfer tools with higher supported limits');
  });
});
