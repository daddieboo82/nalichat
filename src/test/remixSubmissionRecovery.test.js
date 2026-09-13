import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('remix submission recovery', () => {
  it('supports inline track retry and requires a confirmed submission id', async () => {
    const s = await readFile('src/components/challenges/SubmitRemixModal.jsx', 'utf8');
    expect(s).toContain('const loadTracks = useCallback(async () => {');
    expect(s).toContain('onClick={() => void loadTracks()}');
    expect(s).toContain('res?.data?.action !== "submit_remix"');
    expect(s).toContain('res?.data?.userId !== user?.id');
    expect(s).toContain('res?.data?.challengeId !== challenge.id');
    expect(s).toContain('!submission?.id');
    expect(s).toContain('submission.challenge_id !== challenge.id');
    expect(s).toContain('submission.producer_id !== user?.id');
    expect(s).not.toContain('Close and reopen this dialog to retry.');
  });
});
