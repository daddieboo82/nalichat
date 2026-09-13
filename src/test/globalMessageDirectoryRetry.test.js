import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('global message directory retry', () => {
  it('lets users retry a failed people-directory load inline', async () => {
    const s = await readFile('src/components/GlobalMessageDialog.jsx', 'utf8');
    expect(s).toContain('refetch: refetchUsers');
    expect(s).toContain("Couldn't load people.");
    expect(s).toContain('onClick={() => void refetchUsers()}');
  });
});
