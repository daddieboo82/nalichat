// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('quick access unread privacy', () => {
  it('filters unread counts through locked-chat visibility and membership', async () => {
    const source = await readText('src/components/home/QuickAccessGrid.jsx');

    expect(source).toContain('useLockedChats()');
    expect(source).toContain('countVisibleUnreadConversations(');
    expect(source).toContain('lockedChatsUnlocked ? [] : lockedConversationIds');
    expect(source).toContain('enabled: !!user?.id && lockedChatsReady');
  });
});
