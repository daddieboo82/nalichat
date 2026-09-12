// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  LOCKED_CHAT_ACTIVITY_NOTIFICATION_MESSAGE,
  redactLockedChatNotification,
} from '../lib/lockedChatPolicy.js';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('locked chat follow-up reminder privacy', () => {
  it('redacts reminder previews for locked conversations', () => {
    const result = redactLockedChatNotification({
      type: 'follow_up_reminder',
      actor_id: 'owner-1',
      actor_name: 'Follow-up reminder',
      message: 'No one has replied to your message yet.',
      conversation_id: 'conversation-1',
      link: '/messages?id=conversation-1',
    }, ['conversation-1']);

    expect(result.actor_name).toBe('Locked chat');
    expect(result.actor_id).toBe('');
    expect(result.message).toBe(LOCKED_CHAT_ACTIVITY_NOTIFICATION_MESSAGE);
  });

  it('fails closed for conversation-bound reminders before vault state is ready', () => {
    const result = redactLockedChatNotification({
      type: 'follow_up_reminder',
      actor_name: 'Follow-up reminder',
      message: 'No one has replied to your message yet.',
      link: '/messages?id=conversation-1',
    }, [], true);

    expect(result.message).toBe('New activity in a locked chat.');
  });

  it('checks the owner lock preference before server reminder notification creation', async () => {
    const source = await readText('base44/shared/followUpReminders.ts');

    expect(source).toContain('entities.LockedConversationPreference.filter(');
    expect(source).toContain("'New activity in a locked chat.'");
    expect(source).toContain('locked_chat: false');
    expect(source).toContain('conversation_id: reminder.conversation_id');
  });
});
