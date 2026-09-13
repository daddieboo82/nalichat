import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('remix submission recovery', () => {
  it('supports inline track retry and requires a confirmed submission id', async () => {
    const s = await readFile('src/components/challenges/SubmitRemixModal.jsx', 'utf8');
    expect(s).toContain('const loadTracks = useCallback(async () => {');
    expect(s).toContain('onClick={() => void loadTracks()}');
    expect(s).toContain('if (!submission?.id) throw new Error("Remix submission was not confirmed");');
    expect(s).not.toContain('Close and reopen this dialog to retry.');
  });
});
