import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Contacts load recovery', () => {
  it('does not show no-users beneath a failed directory request and exposes retry', async () => {
    const s = await readFile('src/components/messages/ContactsTab.jsx', 'utf8');
    expect(s).toContain('refetch: refetchContacts');
    expect(s).toContain('refetch: refetchUsers');
    expect(s).toContain('if (usersError) void refetchUsers();');
    expect(s).toContain('if (contactsError) void refetchContacts();');
    expect(s).toContain('!usersError && filtered.length === 0');
  });
});
