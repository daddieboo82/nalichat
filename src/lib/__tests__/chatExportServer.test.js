import { describe, expect, it, vi } from 'vitest';
import {
  buildAuthorizedChatExport,
  CHAT_EXPORT_MESSAGE_CAP,
  CHAT_EXPORT_PAGE_SIZE,
} from '../../../base44/shared/chatExport.ts';

function makeEntities({
  conversation = {
    id: 'conversation-1',
    type: 'dm',
    participant_ids: ['user-1', 'user-2'],
  },
  messages = [],
  subscriptions = [{ plan: 'premium', status: 'active' }],
} = {}) {
  const users = {
    'user-1': { id: 'user-1', display_name: 'Avery' },
    'user-2': { id: 'user-2', display_name: 'Blake' },
  };
  return {
    Conversation: {
      get: vi.fn(async (id) => id === conversation?.id ? conversation : null),
    },
    Message: {
      filter: vi.fn(async (query, _sort, limit, skip) => (
        messages
          .filter((message) => message.conversation_id === query.conversation_id)
          .slice(skip, skip + limit)
      )),
    },
    User: {
      get: vi.fn(async (id) => users[id] || null),
    },
    Subscription: {
      filter: vi.fn(async ({ user_id }, _sort, limit, skip) => (
        user_id === 'user-1' ? subscriptions.slice(skip, skip + limit) : []
      )),
    },
  };
}

const user = { id: 'user-1', display_name: 'Avery' };

describe('authorized chat export data', () => {
  it('rejects users who are not conversation members before reading export data', async () => {
    const entities = makeEntities({
      conversation: {
        id: 'conversation-1',
        type: 'dm',
        participant_ids: ['user-2', 'user-3'],
      },
    });

    await expect(buildAuthorizedChatExport({
      entities,
      user,
      conversationId: 'conversation-1',
    })).rejects.toMatchObject({
      status: 403,
      code: 'NOT_A_PARTICIPANT',
    });
    expect(entities.Subscription.filter).not.toHaveBeenCalled();
    expect(entities.Message.filter).not.toHaveBeenCalled();
  });

  it('enforces chat.export on the server', async () => {
    const entities = makeEntities({
      subscriptions: [{ plan: 'free', status: 'active' }],
    });

    await expect(buildAuthorizedChatExport({
      entities,
      user,
      conversationId: 'conversation-1',
    })).rejects.toMatchObject({
      status: 403,
      code: 'CHAT_EXPORT_NOT_ENTITLED',
    });
    expect(entities.Message.filter).not.toHaveBeenCalled();
  });

  it('paginates the full conversation and normalizes replies, threads, edits, and attachments', async () => {
    const messages = Array.from({ length: CHAT_EXPORT_PAGE_SIZE + 2 }, (_, index) => ({
      id: `message-${index + 1}`,
      conversation_id: 'conversation-1',
      sender_id: index % 2 ? 'user-2' : 'user-1',
      sender_name: index % 2 ? 'Spoofed Blake' : 'Spoofed Avery',
      text: index === 0 ? '<script>alert("x")</script>' : `Message ${index + 1}`,
      created_date: new Date(Date.UTC(2026, 8, 10, 12, 0, index)).toISOString(),
      is_edited: index === 1,
      reply_to_sender: index === 2 ? 'Avery' : null,
      reply_to_text: index === 2 ? 'Earlier note' : null,
      thread_id: index === 3 ? 'message-1' : null,
      file_url: index === 4 ? 'https://files.example.com/private/audio.mp3' : null,
      file_name: index === 4 ? 'demo.mp3' : null,
      file_type: index === 4 ? 'audio/mpeg' : null,
      file_size: index === 4 ? 1234 : null,
    }));
    const entities = makeEntities({ messages });

    const result = await buildAuthorizedChatExport({
      entities,
      user,
      conversationId: 'conversation-1',
      now: '2026-09-10T18:00:00.000Z',
    });

    expect(entities.Message.filter).toHaveBeenCalledTimes(2);
    expect(entities.Message.filter.mock.calls[1][3]).toBe(CHAT_EXPORT_PAGE_SIZE);
    expect(result).toMatchObject({
      version: 1,
      exportedAt: '2026-09-10T18:00:00.000Z',
      conversation: {
        title: 'Conversation with Blake',
        type: 'dm',
        participants: ['Avery', 'Blake'],
      },
      limits: {
        messageCap: CHAT_EXPORT_MESSAGE_CAP,
        truncated: false,
      },
    });
    expect(result.messages).toHaveLength(CHAT_EXPORT_PAGE_SIZE + 2);
    expect(result.messages[0]).toMatchObject({
      sender: 'Avery',
      text: '<script>alert("x")</script>',
    });
    expect(result.messages[1].edited).toBe(true);
    expect(result.messages[2].relation.replyTo).toBe('Avery: Earlier note');
    expect(result.messages[3].relation.thread).toBe('Thread reply to message #1');
    expect(result.messages[4].attachment).toEqual({
      name: 'demo.mp3',
      mediaType: 'audio/mpeg',
      sizeBytes: 1234,
      url: 'https://files.example.com/private/audio.mp3',
      unsupported: false,
    });
  });

  it('caps large exports and reports truncation', async () => {
    const messages = Array.from({ length: CHAT_EXPORT_MESSAGE_CAP + 1 }, (_, index) => ({
      id: `message-${index}`,
      conversation_id: 'conversation-1',
      sender_id: 'user-1',
      text: `Message ${index}`,
      created_date: new Date(1_700_000_000_000 + index).toISOString(),
    }));
    const entities = makeEntities({ messages });

    const result = await buildAuthorizedChatExport({
      entities,
      user,
      conversationId: 'conversation-1',
    });

    expect(result.messages).toHaveLength(CHAT_EXPORT_MESSAGE_CAP);
    expect(result.limits.truncated).toBe(true);
    expect(entities.Message.filter).toHaveBeenLastCalledWith(
      { conversation_id: 'conversation-1' },
      'created_date',
      1,
      CHAT_EXPORT_MESSAGE_CAP,
    );
  });

  it('represents soft-deleted and unsupported attachment records without binary data', async () => {
    const entities = makeEntities({
      messages: [
        {
          id: 'deleted',
          conversation_id: 'conversation-1',
          sender_id: 'user-1',
          text: 'secret',
          is_deleted: true,
          file_url: 'https://files.example.com/private.bin',
        },
        {
          id: 'unsupported',
          conversation_id: 'conversation-1',
          sender_id: 'user-2',
          type: 'application/x-private',
          file_name: 'private.bin',
          file_url: 'javascript:alert(1)',
        },
      ],
    });

    const result = await buildAuthorizedChatExport({
      entities,
      user,
      conversationId: 'conversation-1',
    });

    expect(result.messages[0]).toMatchObject({
      deleted: true,
      text: '[Deleted message]',
      attachment: null,
    });
    expect(result.messages[1].attachment).toMatchObject({
      name: 'private.bin',
      url: null,
      unsupported: true,
    });
  });
});
