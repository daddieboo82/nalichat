// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('locked chat notification redaction', () => {
  it('redacts stored and pushed message notifications for locked recipients', async () => {
    const source = await readText('base44/functions/notifyOnMessage/entry.ts');

    expect(source).toContain('LockedConversationPreference.filter(');
    expect(source).toContain('const isLockedChat = lockedRecipientIds.has(recipientId);');
    expect(source).toContain('actor_name: isLockedChat ? "Locked chat"');
    expect(source).toContain('message: isLockedChat');
    expect(source).toContain('"New message in a locked chat."');
    expect(source).toContain('locked_chat: isLockedChat');
    expect(source).toContain("title: isLockedChat ? 'NaliChat'");
  });

  it('defensively redacts client previews and fails closed before vault state is ready', async () => {
    const source = await readText('src/components/notifications/NotificationBell.jsx');

    expect(source).toContain('redactLockedChatNotification(');
    expect(source).toContain('!lockedChatsReady');
    expect(source).toContain('const safeItems = items.map(redactNotification);');
    expect(source).toContain('[user, lockedChatsReady, lockedConversationIds]');
  });

  it('stores the locked-chat redaction marker in the notification schema', async () => {
    const source = await readText('base44/entities/Notification.jsonc');
    expect(source).toContain('"locked_chat"');
  });
});
