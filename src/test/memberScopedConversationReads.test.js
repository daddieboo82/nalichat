// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('member-scoped conversation reads', () => {
  it('loads and locally scopes the private Messages list through user-mode entity reads', async () => {
    const source = await readFile('src/pages/Messages.jsx', 'utf8');

    expect(source).toContain('async function listAll(entity, sort, pageSize = 200)');
    expect(source).toContain('base44.entities.Conversation,');
    expect(source).toContain('"-last_message_at"');
    expect(source).toContain('conversation?.participant_ids?.includes(currentUser.id)');
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
