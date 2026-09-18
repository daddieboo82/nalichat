// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('member-scoped conversation reads', () => {
  it('loads the private Messages list through a member-scoped backend response', async () => {
    const source = await readFile('src/pages/Messages.jsx', 'utf8');
    const backend = await readFile('base44/functions/manageConversation/entry.ts', 'utf8');

    expect(source).toContain('action: "list_member_conversations"');
    expect(source).toContain('res?.data?.userId !== currentUser.id');
    expect(source).toContain('conversation?.participant_ids?.includes(currentUser.id)');
    expect(backend).toContain("if (action === 'list_member_conversations')");
    expect(backend).toContain('{ participant_ids: user.id }');
    expect(backend).toContain('conversation.participant_ids.includes(user.id)');
    expect(source).not.toContain('queryFn: () => base44.entities.Conversation.list("-last_message_at")');
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
