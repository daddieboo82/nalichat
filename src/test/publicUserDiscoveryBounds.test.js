// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('public user discovery bounds', () => {
  it('caps service-role discovery fan-out reads', async () => {
    const source = await readText('base44/functions/listPublicUsers/entry.ts');
    expect(source).toContain('MAX_DISCOVERY_USERS = 1000');
    expect(source).toContain('MAX_DISCOVERY_ACHIEVEMENTS = 5000');
    expect(source).toContain('MAX_DISCOVERY_CONTACTS = 1000');
    expect(source).toContain('MAX_DISCOVERY_CONVERSATIONS = 1000');
    expect(source).toContain("User.list('-created_date', MAX_DISCOVERY_USERS)");
    expect(source).toContain("Achievement.list('-created_date', MAX_DISCOVERY_ACHIEVEMENTS)");
    expect(source).toMatch(/Contact\.filter\([\s\S]*MAX_DISCOVERY_CONTACTS/);
    expect(source).toMatch(/Conversation\.filter\([\s\S]*MAX_DISCOVERY_CONVERSATIONS/);
  });
});
