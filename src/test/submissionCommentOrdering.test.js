import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('submission comment ordering', () => {
  it('appends newly created comments using functional state to match server chronology', async () => {
    const s = await readFile('src/components/challenges/SubmissionComments.jsx', 'utf8');
    expect(s).toContain('setComments((current) => [...current, created]);');
    expect(s).toContain('!Array.isArray(res?.data?.comments)');
    expect(s).toContain('Comment list response was invalid.');
    expect(s).toContain('!created?.id || created.track_id !== submissionId || created.parent_type !== "challenge_submission"');
    expect(s).toContain('Comment creation was not confirmed.');
    expect(s).not.toContain('[created, ...comments]');
  });
});
