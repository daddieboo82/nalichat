// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('NaliBase tool entry', () => {
  it('opens tools without a full-screen entry overlay', async () => {
    const layout = await readFile(new URL('../components/layout/AppLayout.jsx', import.meta.url), 'utf8');
    expect(layout).not.toContain('StorefrontEntryTransition');
  });
});
