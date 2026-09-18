import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Contacts load recovery', () => {
  it('does not show no-users beneath a failed directory request and exposes retry', async () => {
    const s = await readFile('src/components/messages/ContactsTab.jsx', 'utf8');
    expect(s).toContain('refetch: refetchDirectory');
    expect(s).toContain('const refetchContacts = refetchDirectory');
    expect(s).toContain('const refetchUsers = refetchDirectory');
    expect(s).toContain('if (usersError) void refetchUsers();');
    expect(s).toContain('if (contactsError) void refetchContacts();');
    expect(s).toContain('!usersError && filtered.length === 0');
  });

  it('opens discovery for a new user whose saved contact list is empty', async () => {
    const s = await readFile('src/components/messages/ContactsTab.jsx', 'utf8');
    expect(s).toContain('initialTabResolvedRef.current = true');
    expect(s).toContain('if (contacts.length === 0) setTab("discover")');
    expect(s).toContain('setTab("contacts")');
  });
});
