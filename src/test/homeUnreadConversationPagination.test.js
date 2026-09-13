import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('home unread conversation pagination', () => {
  it('scans all user conversations instead of only the first 500', async () => {
    const s = await readFile('src/components/home/QuickAccessGrid.jsx', 'utf8');
    expect(s).toContain('async function listAllUserConversations(userId)');
    expect(s).toContain('for (let skip = 0; ; skip += pageSize)');
    expect(s).toContain('const conversations = await listAllUserConversations(user.id)');
    expect(s).not.toContain('"-last_message_at",\n          500,');
  });
});
