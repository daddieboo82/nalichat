// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('Messages deep-link navigation', () => {
  it('opens allowed chats and gates locked chats behind the vault dialog', async () => {
    const source = await readText('src/pages/Messages.jsx');

    expect(source).toContain('new URLSearchParams(location.search).get("id")');
    expect(source).toContain('resolveRequestedConversation(');
    expect(source).toContain('if (resolution.status === "allowed")');
    expect(source).toContain('} else if (resolution.status === "locked")');
    expect(source).toContain('<LockedChatAccessDialog');
    expect(source).toContain('if (lockedLinkConversationId) handleSelectConv(lockedLinkConversationId);');
  });
});
