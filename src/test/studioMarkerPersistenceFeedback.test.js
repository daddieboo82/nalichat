import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio marker persistence feedback', () => {
  it('warns when marker restore or save fails', async () => {
    const s = await readFile('src/components/studio/MarkersBar.jsx', 'utf8');
    expect(s).toContain("Couldn't restore saved markers on this device.");
    expect(s).toContain("Marker updated for this session, but couldn't be saved on this device.");
    expect(s).toContain('console.error("Failed to persist Studio markers", error);');
  });
});
