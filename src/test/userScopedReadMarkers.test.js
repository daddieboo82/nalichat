// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('user-scoped conversation read markers', () => {
  it('keeps unread state isolated across accounts in the same browser', async () => {
    const messages = await readText('src/pages/Messages.jsx');
    const quickAccess = await readText('src/components/home/QuickAccessGrid.jsx');
    const conversationList = await readText('src/components/messages/ConversationList.jsx');

    expect(messages).toContain('lastReadAt:${currentUser?.id}:${convId}');
    expect(quickAccess).toContain('lastReadAt:${user.id}:${conversationId}');
    expect(conversationList).toContain('lastReadAt:${currentUserId}:${conv.id}');
    expect(messages).not.toContain('lastReadAt:${convId}');
    expect(quickAccess).not.toContain('lastReadAt:${conversationId}');
    expect(conversationList).not.toContain('lastReadAt:${conv.id}');
  });
});
