import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('message contact pagination', () => {
  it('loads all contacts in the Contacts tab and New Chat dialog', async () => {
    for (const path of [
      'src/components/messages/ContactsTab.jsx',
      'src/components/messages/NewChatDialog.jsx',
    ]) {
      const s = await readFile(path, 'utf8');
      expect(s).toContain('async function listAllContacts(userId)');
      expect(s).toContain('for (let skip = 0; ; skip += pageSize)');
      expect(s).toContain('pageSize,\n      skip,');
      expect(s).toContain('if (page.length < pageSize) return rows');
      expect(s).not.toContain('Contact.filter({ user_id: currentUserId }, "-created_date", 500)');
    }
  });
});
