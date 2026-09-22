// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('locked chat notification redaction', () => {
  it('redacts stored and pushed message notifications for locked recipients', async () => {
    const source = await readText('base44/functions/notifyOnMessage/entry.ts');
    const helper = await readText('base44/shared/lockedChats.ts');

    expect(source).toContain('LockedConversationPreference.filter(');
    expect(source).toContain('const isLockedChat = lockedRecipientIds.has(recipientId);');
    expect(source).toContain('...lockedNotification(conversation.id)');
    expect(source).toContain("title: isLockedChat ? 'NaliBase'");
    expect(helper).toContain("actor_name: 'Locked chat'");
    expect(helper).toContain("message = 'New message in a locked chat.'");
    expect(helper).toContain('locked_chat: true');
  });

  it('defensively redacts client previews and fails closed before vault state is ready', async () => {
    const source = await readText('src/components/notifications/NotificationBell.jsx');

    expect(source).toContain('redactLockedChatNotification(');
    expect(source).toContain('!lockedChatsReady');
    expect(source).toContain('const safeItems = items.map(redactNotification);');
    expect(source).toContain('[user?.id, lockedChatsReady, lockedConversationIds]');
  });

  it('stores the locked-chat redaction marker in the notification schema', async () => {
    const source = await readText('base44/entities/Notification.jsonc');
    expect(source).toContain('"locked_chat"');
  });
});
