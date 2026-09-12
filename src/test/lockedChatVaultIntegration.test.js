// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('locked chat vault integration', () => {
  it('mounts the provider and exposes privacy settings', async () => {
    const app = await readText('src/App.jsx');
    const settings = await readText('src/pages/Settings.jsx');

    expect(app).toContain('import { LockedChatsProvider }');
    expect(app).toContain('<LockedChatsProvider>');
    expect(settings).toContain('import LockedChatSettings');
    expect(settings).toContain('<LockedChatSettings />');
  });

  it('fails closed and hides locked conversations until the vault is unlocked', async () => {
    const messages = await readText('src/pages/Messages.jsx');

    expect(messages).toContain('useLockedChats()');
    expect(messages).toContain('lockedChatsUnlocked ? [] : lockedConversationIds');
    expect(messages).toContain(': { visible: [], locked: [] }');
    expect(messages).toContain('enabled: !!currentUser?.id && !!selectedConvId && lockedChatsReady && canAccessConversation(selectedConvId)');
    expect(messages).toContain('if (!lockedChatsReady || !canAccessConversation(selectedConvId))');
  });
});
