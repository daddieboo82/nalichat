// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('member-scoped conversation reads', () => {
  it('scopes the private Messages list to the member through a user-mode entity read', async () => {
    const source = await readFile('src/pages/Messages.jsx', 'utf8');

    // The member scope belongs in the query so each poll costs the user's own
    // conversations, not the whole table plus a browser-side filter.
    expect(source).toMatch(
      /const requestingUserId = currentUser\.id;\s+const rows = await filterAll\(\s*base44\.entities\.Conversation,\s*\{ participant_ids: requestingUserId \},\s*"-last_message_at",\s*\)/,
    );
    expect(source).not.toContain('async function listAll(');
    expect(source).not.toContain('action: "list_member_conversations"');
  });

  it('scopes the home unread query to conversations containing the active user', async () => {
    const source = await readFile('src/components/home/QuickAccessGrid.jsx', 'utf8');
    expect(source).toContain('async function listAllUserConversations(userId)');
    expect(source).toContain('base44.entities.Conversation.filter(');
    expect(source).toContain('{ participant_ids: userId }');
    expect(source).toContain('listAllUserConversations(user.id)');
    expect(source).not.toContain('Conversation.list("-last_message_at", 500)');
  });
});