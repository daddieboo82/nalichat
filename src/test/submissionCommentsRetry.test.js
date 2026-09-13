import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('submission comments retry', () => {
  it('retries failed comment loads in place', async () => {
    const s = await readFile('src/components/challenges/SubmissionComments.jsx', 'utf8');
    expect(s).toContain('const loadComments = useCallback(async () => {');
    expect(s).toContain('onClick={() => void loadComments()}');
    expect(s).toContain("Couldn't load comments.");
    expect(s).not.toContain('Reopen this submission to retry.');
  });
});
