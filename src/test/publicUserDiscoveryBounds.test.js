// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('public user discovery bounds', () => {
  it('keeps the public discovery feed bounded while relationship scans paginate fully', async () => {
    const source = await readText('base44/functions/listPublicUsers/entry.ts');

    expect(source).toContain('MAX_DISCOVERY_USERS = 1000');
    expect(source).toContain('MAX_DISCOVERY_ACHIEVEMENTS = 5000');
    expect(source).toContain("User.list('-created_date', MAX_DISCOVERY_USERS)");
    expect(source).toContain("Achievement.list('-created_date', MAX_DISCOVERY_ACHIEVEMENTS)");

    expect(source).toContain('async function filterAllRows(');
    expect(source).toContain('for (let skip = 0; ; skip += pageSize)');
    expect(source).toContain('base44.asServiceRole.entities.Contact');
    expect(source).toContain('base44.asServiceRole.entities.Conversation');
    expect(source).not.toContain('MAX_DISCOVERY_CONTACTS');
    expect(source).not.toContain('MAX_DISCOVERY_CONVERSATIONS');
  });
});
