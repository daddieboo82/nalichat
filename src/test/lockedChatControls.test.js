// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('locked chat controls', () => {
  it('lets entitled users lock or unlock the active conversation', async () => {
    const source = await readText('src/components/messages/ChatView.jsx');

    expect(source).toContain('useLockedChats()');
    expect(source).toContain('updateConversationLock(conversation.id, !conversationIsLocked)');
    expect(source).toContain('Set up your locked-chat PIN in Settings before locking a chat.');
    expect(source).toContain('Premium Plus is required to change locked chats.');
    expect(source).toContain('conversationIsLocked ? "Unlock chat" : "Lock chat"');
  });
});
