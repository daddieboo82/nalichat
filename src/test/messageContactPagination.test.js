import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('message contact pagination', () => {
  it('loads all contacts in the Contacts tab and New Chat dialog', async () => {
    const contactsTab = await readFile('src/components/messages/ContactsTab.jsx', 'utf8');
    expect(contactsTab).toContain("base44.functions.invoke('listPublicUsers', { includePresence: true })");
    expect(contactsTab).toContain('contacts: res.data.contacts');
    expect(contactsTab).not.toContain('base44.entities.Contact.filter');

    const newChat = await readFile('src/components/messages/NewChatDialog.jsx', 'utf8');
    expect(newChat).toContain('async function listAllContacts(userId)');
    expect(newChat).toContain('for (let skip = 0; ; skip += pageSize)');
    expect(newChat).toContain('pageSize,\n      skip,');
    expect(newChat).toContain('if (page.length < pageSize) return rows');
  });
});
