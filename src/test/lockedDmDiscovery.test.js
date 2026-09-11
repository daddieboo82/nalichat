// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('locked DM discovery', () => {
  it('routes existing locked DMs through the PIN gate', async () => {
    const source = await readText('src/pages/Messages.jsx');

    expect(source).toContain('lockedConversationIds.includes(conv.id) && !lockedChatsUnlocked');
    expect(source).toContain('setLockedLinkConversationId(conv.id);');
    expect(source).toContain('setShowLockedAccess(true);');
  });
});
