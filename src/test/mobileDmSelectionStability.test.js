import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('mobile DM selection stability', () => {
  it('does not reset selected conversation on same-user query-string changes', async () => {
    const source = await readFile('src/pages/Messages.jsx', 'utf8');
    expect(source).toContain('previousUserId !== nextUserId');
    expect(source).toContain('window.location.pathname === "/messages"');
    expect(source).toContain('}, [currentUser?.id, navigate]);');
    expect(source).not.toContain('}, [currentUser?.id, location.pathname, location.search, navigate]);');
  });
});
