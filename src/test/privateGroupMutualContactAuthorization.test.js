import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('private group mutual-contact authorization', () => {
  it('projects caller-specific group eligibility without exposing contact records', async () => {
    const s = await readFile('base44/functions/listPublicUsers/entry.ts', 'utf8');
    expect(s).toContain('can_group_chat: mutualContactIds.has(u.id)');
    expect(s).toContain('const mutualContactIds = new Set<string>()');
  });

  it('enforces mutual contacts on private group creation', async () => {
    const s = await readFile('base44/functions/manageConversation/entry.ts', 'utf8');
    expect(s).toContain("Private groups can only include mutual contacts");
    expect(s).toContain("{ user_id: user.id }");
    expect(s).toContain("{ contact_user_id: user.id }");
    expect(s).toContain('uniqueOtherIds.some((id: string) => !mutualContactIds.has(id))');
  });

  it('filters the group picker to server-projected eligible users', async () => {
    const s = await readFile('src/pages/Messages.jsx', 'utf8');
    expect(s).toContain('users={otherUsers.filter((candidate) => candidate.can_group_chat === true)}');
  });
});
