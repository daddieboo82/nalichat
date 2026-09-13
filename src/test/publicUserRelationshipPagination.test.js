import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('public user relationship pagination', () => {
  it('paginates contacts and shared conversations used for presence and group eligibility', async () => {
    const s = await readFile('base44/functions/listPublicUsers/entry.ts', 'utf8');
    expect(s).toContain('async function filterAllRows(');
    expect(s).toContain('for (let skip = 0; ; skip += pageSize)');
    expect(s).toContain('filterAllRows(\n          base44.asServiceRole.entities.Contact');
    expect(s).toContain('filterAllRows(\n              base44.asServiceRole.entities.Conversation');
    expect(s).toContain('can_group_chat: mutualContactIds.has(u.id)');
    expect(s).not.toContain('MAX_DISCOVERY_CONTACTS');
    expect(s).not.toContain('MAX_DISCOVERY_CONVERSATIONS');
  });
});
