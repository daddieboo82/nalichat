// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio track import validation', () => {
  it('marks unsupported secure uploads as errors before queue upload starts', async () => {
    const source = await readFile('src/components/studio/TrackImporter.jsx', 'utf8');
    expect(source).toContain('validateUpload(file)');
    expect(source).toContain('status: validation.ok ? "pending" : "error"');
    expect(source).toContain('error: validation.ok ? null : validation.error');
  });
});
