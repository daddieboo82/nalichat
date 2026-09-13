// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('member-scoped conversation reads', () => {
  it('does not fetch discoverable public rooms into the private Messages list', async () => {
    const source = await readFile('src/pages/Messages.jsx', 'utf8');
    expect(source).toContain('filterAll(');
    expect(source).toContain('base44.entities.Conversation');
    expect(source).toContain('{ participant_ids: currentUser.id }');
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
