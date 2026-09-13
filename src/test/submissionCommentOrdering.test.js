import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('submission comment ordering', () => {
  it('appends newly created comments using functional state to match server chronology', async () => {
    const s = await readFile('src/components/challenges/SubmissionComments.jsx', 'utf8');
    expect(s).toContain('if (created) setComments((current) => [...current, created]);');
    expect(s).not.toContain('[created, ...comments]');
  });
});
