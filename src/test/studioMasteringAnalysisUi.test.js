import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio mastering analysis UI', () => {
  it('does not advertise encoded export formats when backend is analysis-only', async () => {
    const s = await readFile('src/components/studio/ExportBounce.jsx', 'utf8');
    expect(s).toContain('Mastering Analysis');
    expect(s).toContain('Audio re-encoding is not available yet.');
    expect(s).toContain('Run Mastering Analysis');
    expect(s).not.toContain('Export & Bounce');
    expect(s).not.toContain('Export as {format.toUpperCase()}');
    expect(s).not.toContain('const EXPORT_FORMATS');
  });
});
