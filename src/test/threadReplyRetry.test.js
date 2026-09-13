import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('thread reply load recovery', () => {
  it('lets users retry failed thread loads immediately', async () => {
    const s = await readFile('src/components/messages/ThreadPanel.jsx', 'utf8');
    expect(s).toContain('refetch: refetchReplies');
    expect(s).toContain('onClick={() => void refetchReplies()}');
    expect(s).toContain("Couldn't load thread replies.");
  });
});
