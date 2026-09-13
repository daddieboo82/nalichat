// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('challenge source upload limits', () => {
  it('uses the same client validation as secureUploadFile', async () => {
    const source = await readFile('src/pages/CreateChallenge.jsx', 'utf8');
    expect(source).toContain('validateUpload(sourceTrackFile)');
    expect(source).not.toContain('sourceTrackFile.size > 100 * 1024 * 1024');
    expect(source).not.toContain('Challenge source tracks must be 100MB or smaller.');
  });
});
