import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('contact mutation group eligibility refresh', () => {
  it('refreshes public user relationship capabilities after add and delete', async () => {
    const s = await readFile('src/components/messages/ContactsTab.jsx', 'utf8');
    const matches = s.match(/invalidateQueries\(\{ queryKey: \["users", "presence", currentUserId\] \}\)/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});
